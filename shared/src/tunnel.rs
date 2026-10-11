use crate::{
    database::Database,
    models::egg_configuration::{EggConfiguration, EggConfigurationTarget},
    prelude::*,
};
use ed25519_dalek::pkcs8::EncodePrivateKey;
use serde::{Deserialize, Serialize};
use sqlx::{Row, Type};
use std::{
    collections::HashSet,
    sync::{Arc, OnceLock},
};
use tundra_common::{
    hash::Hash32,
    jwt::JwtIssuer,
    state::{AclEntry, NodeEntry, PortSpec, Proto, ServerEntry, Snapshot},
};
use utoipa::ToSchema;

pub use tundra_common::state::MAX_SERVER_IDX;

const JWT_KEY_SETTING: &str = "::tunnel_jwt_key";

/// Every write that changes what [`snapshot`] would return has to bump the epoch, or the nodes
/// keep serving the state they already hold. Models bump; the route that owns the commit then
/// calls [`poke_nodes`].
pub async fn bump_epoch<'a>(
    executor: impl sqlx::PgExecutor<'a>,
) -> Result<i64, crate::database::DatabaseError> {
    Ok(sqlx::query_scalar("SELECT nextval('tunnel_epoch')")
        .fetch_one(executor)
        .await?)
}

pub async fn bump_epoch_if_node_on_mesh(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    node_uuid: uuid::Uuid,
) -> Result<bool, crate::database::DatabaseError> {
    let member: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM node_tunnels WHERE node_tunnels.node_uuid = $1)",
    )
    .bind(node_uuid)
    .fetch_one(&mut **transaction)
    .await?;

    if member {
        bump_epoch(&mut **transaction).await?;
    }

    Ok(member)
}

pub async fn bump_epoch_if_server_on_mesh(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    server_uuid: uuid::Uuid,
) -> Result<bool, crate::database::DatabaseError> {
    let member: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM server_tunnels WHERE server_tunnels.server_uuid = $1)",
    )
    .bind(server_uuid)
    .fetch_one(&mut **transaction)
    .await?;

    if member {
        bump_epoch(&mut **transaction).await?;
    }

    Ok(member)
}

pub async fn epoch<'a>(
    executor: impl sqlx::PgExecutor<'a>,
) -> Result<i64, crate::database::DatabaseError> {
    Ok(sqlx::query_scalar("SELECT last_value FROM tunnel_epoch")
        .fetch_one(executor)
        .await?)
}

pub fn frontend_address(idx: u16) -> Option<compact_str::CompactString> {
    tundra_common::state::frontend_ip(idx).map(|ip| compact_str::format_compact!("{ip}"))
}

#[inline]
pub fn alias_of(uuid_short: i32) -> compact_str::CompactString {
    compact_str::format_compact!("{uuid_short:08x}")
}

#[inline]
pub fn is_alias_shaped(name: &str) -> bool {
    name.len() == 8
        && name
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

pub struct TunnelSigner {
    pub issuer: JwtIssuer,
    pub public: Hash32,
}

static SIGNER: OnceLock<Arc<TunnelSigner>> = OnceLock::new();

pub async fn signer(
    database: &Database,
) -> Result<Arc<TunnelSigner>, crate::database::DatabaseError> {
    if let Some(signer) = SIGNER.get() {
        return Ok(Arc::clone(signer));
    }

    let stored: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = $1")
        .bind(JWT_KEY_SETTING)
        .fetch_optional(database.read())
        .await?;

    let stored = match stored {
        Some(stored) => stored,
        None => {
            let candidate = database
                .encrypt_base64(hex::encode(rand::random::<[u8; 32]>()))
                .await?;

            sqlx::query_scalar(
                r#"
                INSERT INTO settings (key, value)
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = settings.value
                RETURNING value
                "#,
            )
            .bind(JWT_KEY_SETTING)
            .bind(candidate.as_str())
            .fetch_one(database.write())
            .await?
        }
    };

    let mut seed = [0; 32];
    hex::decode_to_slice(database.decrypt_base64(stored).await?.as_str(), &mut seed)
        .map_err(|err| anyhow::anyhow!("the stored tunnel signing key is malformed: {err}"))?;

    let key = ed25519_dalek::SigningKey::from_bytes(&seed);
    let public = Hash32(key.verifying_key().to_bytes());
    let issuer = JwtIssuer::from_pkcs8_der(
        key.to_pkcs8_der()
            .map_err(|err| anyhow::anyhow!("failed to encode the tunnel signing key: {err}"))?
            .as_bytes(),
    );

    Ok(Arc::clone(
        SIGNER.get_or_init(|| Arc::new(TunnelSigner { issuer, public })),
    ))
}

fn proto_of(protocols: &[TunnelProtocol]) -> Proto {
    match (
        protocols.contains(&TunnelProtocol::Tcp),
        protocols.contains(&TunnelProtocol::Udp),
    ) {
        (true, true) => Proto::Both,
        (false, true) => Proto::Udp,
        _ => Proto::Tcp,
    }
}

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "tunnel_protocol", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TunnelProtocol {
    Tcp,
    Udp,
}

pub async fn snapshot(database: &Database) -> Result<Snapshot, crate::database::DatabaseError> {
    let jwt_pubkey = signer(database).await?.public;

    let mut transaction = database.write().begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *transaction)
        .await?;

    let epoch = epoch(&mut *transaction).await?;
    let configurations = EggConfiguration::all(&mut *transaction).await?;

    let nodes = sqlx::query(
        r#"
        SELECT nodes.uuid, nodes.name, node_tunnels.host, node_tunnels.port, node_tunnels.cert_sha256
        FROM node_tunnels
        JOIN nodes ON nodes.uuid = node_tunnels.node_uuid
        "#,
    )
    .fetch_all(&mut *transaction)
    .await?
    .into_iter()
    .map(|row| {
        Ok::<_, crate::database::DatabaseError>(NodeEntry {
            uuid: row.try_get("uuid")?,
            name: row.try_get::<String, _>("name")?,
            host: row.try_get::<String, _>("host")?,
            tunnel_port: row.try_get::<i32, _>("port")? as u16,
            cert_sha256: row
                .try_get::<Option<Vec<u8>>, _>("cert_sha256")?
                .and_then(|bytes| <[u8; 32]>::try_from(bytes.as_slice()).ok())
                .map(Hash32),
        })
    })
    .try_collect_vec()?;

    let mut ports: std::collections::HashMap<uuid::Uuid, Vec<PortSpec>> =
        std::collections::HashMap::new();
    for row in sqlx::query(
        r#"
        SELECT server_tunnel_ports.server_uuid, server_tunnel_ports.port, server_tunnel_ports.protocols
        FROM server_tunnel_ports
        ORDER BY server_tunnel_ports.port
        "#,
    )
    .fetch_all(&mut *transaction)
    .await?
    {
        ports
            .entry(row.try_get("server_uuid")?)
            .or_default()
            .push(PortSpec {
                port: row.try_get::<i32, _>("port")? as u16,
                proto: proto_of(&row.try_get::<Vec<TunnelProtocol>, _>("protocols")?),
            });
    }

    let mut servers = Vec::new();
    for row in sqlx::query(
        r#"
        SELECT
            server_tunnels.server_uuid,
            server_tunnels.idx,
            server_tunnels.name,
            servers.node_uuid,
            servers.uuid_short,
            servers.egg_uuid,
            nest_eggs.nest_uuid,
            nodes.location_uuid
        FROM server_tunnels
        JOIN servers ON servers.uuid = server_tunnels.server_uuid
        JOIN node_tunnels ON node_tunnels.node_uuid = servers.node_uuid
        JOIN nest_eggs ON nest_eggs.uuid = servers.egg_uuid
        JOIN nodes ON nodes.uuid = servers.node_uuid
        "#,
    )
    .fetch_all(&mut *transaction)
    .await?
    {
        let target = EggConfigurationTarget::map(&row)?;
        if !EggConfiguration::merge(&configurations, &target).private_network_enabled() {
            continue;
        }

        let uuid: uuid::Uuid = row.try_get("server_uuid")?;
        servers.push(ServerEntry {
            uuid,
            idx: row.try_get::<i32, _>("idx")? as u16,
            node_uuid: row.try_get("node_uuid")?,
            name: row.try_get::<String, _>("name")?,
            aliases: vec![alias_of(row.try_get::<i32, _>("uuid_short")?).into()],
            container_ref: String::new(),
            dial_addr: None,
            ports: ports.remove(&uuid).unwrap_or_default(),
        });
    }

    let on_mesh = servers
        .iter()
        .map(|server| server.uuid)
        .collect::<HashSet<_>>();
    let mut acls = Vec::new();
    for row in sqlx::query(
        r#"
        SELECT server_tunnel_connections.src_server_uuid, server_tunnel_connections.dst_server_uuid
        FROM server_tunnel_connections
        ORDER BY server_tunnel_connections.src_server_uuid, server_tunnel_connections.dst_server_uuid
        "#,
    )
    .fetch_all(&mut *transaction)
    .await?
    {
        let acl = AclEntry {
            src_server: row.try_get("src_server_uuid")?,
            dst_server: row.try_get("dst_server_uuid")?,
        };

        if on_mesh.contains(&acl.src_server) && on_mesh.contains(&acl.dst_server) {
            acls.push(acl);
        }
    }

    transaction.commit().await?;

    Ok(Snapshot {
        epoch: epoch as u64,
        jwt_pubkey,
        nodes,
        servers,
        acls,
    })
}

const POKE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// Tells every node on the mesh to pull the snapshot now rather than on its next poll. Must be
/// called *after* the commit that bumped the epoch, or a node can win the race and re-read the
/// state it already has. Batched under one key, so several bumps in a request collapse to one
/// round of pokes, and spawned so the batch loop is not held for the length of the requests.
pub async fn poke_nodes(database: &Arc<Database>) {
    database
        .batch_action("poke_tunnel_nodes", uuid::Uuid::nil(), {
            let database = Arc::clone(database);

            async move {
                tokio::spawn(async move {
                    if let Err(err) = poke_nodes_now(&database).await {
                        tracing::warn!("failed to poke the tunnel nodes: {:?}", err);
                    }
                });

                Ok(())
            }
        })
        .await;
}

async fn poke_nodes_now(database: &Database) -> Result<(), crate::database::DatabaseError> {
    let rows = sqlx::query(
        r#"
        SELECT nodes.uuid, nodes.url, nodes.token
        FROM node_tunnels
        JOIN nodes ON nodes.uuid = node_tunnels.node_uuid
        "#,
    )
    .fetch_all(database.read())
    .await?;

    let mut pokes = Vec::with_capacity(rows.len());
    for row in rows {
        let uuid: uuid::Uuid = row.try_get("uuid")?;
        let client = wings_api::client::WingsClient::new(
            row.try_get::<String, _>("url")?,
            database
                .decrypt(row.try_get::<Vec<u8>, _>("token")?)
                .await?
                .into(),
        );

        pokes.push(tokio::spawn(async move {
            match tokio::time::timeout(POKE_TIMEOUT, client.post_tundra_sync()).await {
                Ok(Ok(())) => {}
                Ok(Err(err)) => tracing::debug!(node = %uuid, "failed to poke node: {:?}", err),
                Err(_) => tracing::debug!(node = %uuid, "poking node timed out"),
            }
        }));
    }

    for poke in pokes {
        let _ = poke.await;
    }

    Ok(())
}
