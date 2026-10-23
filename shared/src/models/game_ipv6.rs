//! Persistent IPv6 ownership and reconciliation. Reservations survive ambiguous runtime outcomes.
use crate::{
    State,
    models::{ByUuid, node::Node, server::Server},
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Row, Transaction};
use std::net::Ipv6Addr;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NodeNetwork {
    pub prefix: String,
    #[serde(default)]
    pub reserved: Vec<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct NetworkStatus {
    pub address: Option<String>,
    pub applied_address: Option<String>,
    pub pending: bool,
    pub retry_after_seconds: i64,
    pub error: Option<String>,
}

pub fn network_bits(value: &str) -> anyhow::Result<u128> {
    let ip: Ipv6Addr = value
        .strip_suffix("/64")
        .ok_or_else(|| anyhow::anyhow!("Game prefix must be /64"))?
        .parse()?;
    let bits = u128::from(ip);
    anyhow::ensure!(
        bits >> 125 == 1 && bits as u64 == 0,
        "Use a canonical globally routable /64"
    );
    Ok(bits)
}

fn usable(bits: u128, address: Ipv6Addr, reserved: &[String]) -> bool {
    let address_bits = u128::from(address);
    address_bits >> 64 == bits >> 64
        && address_bits as u64 > 1
        && address_bits as u64 != u64::MAX - 1
        && !reserved
            .iter()
            .any(|ip| ip.parse::<Ipv6Addr>().ok() == Some(address))
}

pub async fn node_network(state: &State, node: uuid::Uuid) -> anyhow::Result<Option<NodeNetwork>> {
    let row = sqlx::query("SELECT prefix::text, reserved FROM game_ipv6_nodes WHERE node_uuid=$1")
        .bind(node)
        .fetch_optional(state.database.read())
        .await?;
    row.map(|r| {
        Ok(NodeNetwork {
            prefix: r.try_get("prefix")?,
            reserved: serde_json::from_value(r.try_get("reserved")?)?,
        })
    })
    .transpose()
}

pub async fn set_node_network(
    state: &State,
    node: uuid::Uuid,
    mut config: NodeNetwork,
) -> anyhow::Result<()> {
    let bits = network_bits(&config.prefix)?;
    config.prefix = format!("{}/64", Ipv6Addr::from(bits));
    for ip in &config.reserved {
        let ip: Ipv6Addr = ip.parse()?;
        anyhow::ensure!(
            u128::from(ip) >> 64 == bits >> 64,
            "Reserved address must belong to the game prefix"
        );
    }
    config.reserved.sort();
    config.reserved.dedup();
    let mut tx = state.database.write().begin().await?;
    // Serialize prefix edits and address allocation on this node.
    sqlx::query("SELECT uuid FROM nodes WHERE uuid=$1 FOR UPDATE")
        .bind(node)
        .fetch_one(&mut *tx)
        .await?;
    let addresses: Vec<String> =
        sqlx::query_scalar("SELECT host(address) FROM game_ipv6_addresses WHERE node_uuid=$1")
            .bind(node)
            .fetch_all(&mut *tx)
            .await?;
    for address in addresses {
        anyhow::ensure!(
            usable(bits, address.parse()?, &config.reserved),
            "Prefix/reservations conflict with an assigned or retiring address; migrate it first"
        );
    }
    sqlx::query("INSERT INTO game_ipv6_nodes(node_uuid,prefix,reserved) VALUES($1,$2::inet,$3) ON CONFLICT(node_uuid) DO UPDATE SET prefix=EXCLUDED.prefix,reserved=EXCLUDED.reserved")
        .bind(node).bind(config.prefix).bind(serde_json::to_value(config.reserved)?).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

async fn reserve(
    tx: &mut Transaction<'_, Postgres>,
    server: uuid::Uuid,
    node: uuid::Uuid,
    config: &NodeNetwork,
    manual: Option<&str>,
) -> anyhow::Result<String> {
    let bits = network_bits(&config.prefix)?;
    for _ in 0..32 {
        // rand::random uses the thread-local cryptographically secure generator.
        let ip = match manual {
            Some(ip) => ip.parse()?,
            None => Ipv6Addr::from(bits | u128::from(rand::random::<u64>())),
        };
        if !usable(bits, ip, &config.reserved) {
            anyhow::ensure!(
                manual.is_none(),
                "Address is reserved or outside the game prefix"
            );
            continue;
        }
        let address = ip.to_string();
        let inserted = sqlx::query("INSERT INTO game_ipv6_addresses(address,node_uuid,server_uuid) VALUES($1::inet,$2,$3) ON CONFLICT DO NOTHING")
            .bind(&address).bind(node).bind(server).execute(&mut **tx).await?.rows_affected();
        if inserted == 1 {
            return Ok(address);
        }
        anyhow::ensure!(manual.is_none(), "IPv6 address is already reserved");
    }
    anyhow::bail!("Could not reserve a unique IPv6 address")
}

pub async fn configuration(
    state: &State,
    server: uuid::Uuid,
    node: uuid::Uuid,
) -> anyhow::Result<Option<wings_api::GameIpv6>> {
    let mut tx = state.database.write().begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(server.to_string())
        .execute(&mut *tx)
        .await?;
    sqlx::query("SELECT uuid FROM nodes WHERE uuid=$1 FOR UPDATE")
        .bind(node)
        .fetch_one(&mut *tx)
        .await?;
    let Some(row) =
        sqlx::query("SELECT prefix::text,reserved FROM game_ipv6_nodes WHERE node_uuid=$1")
            .bind(node)
            .fetch_optional(&mut *tx)
            .await?
    else {
        return Ok(None);
    };
    let config = NodeNetwork {
        prefix: row.try_get("prefix")?,
        reserved: serde_json::from_value(row.try_get("reserved")?)?,
    };
    let old = sqlx::query(
        "SELECT node_uuid,host(desired) AS desired FROM game_ipv6_servers WHERE server_uuid=$1",
    )
    .bind(server)
    .fetch_optional(&mut *tx)
    .await?;
    let address = if let Some(row) = old.filter(|r| r.get::<uuid::Uuid, _>("node_uuid") == node) {
        row.try_get("desired")?
    } else {
        let address = reserve(&mut tx, server, node, &config, None).await?;
        sqlx::query("INSERT INTO game_ipv6_servers(server_uuid,node_uuid,desired) VALUES($1,$2,$3::inet) ON CONFLICT(server_uuid) DO UPDATE SET node_uuid=EXCLUDED.node_uuid,desired=EXCLUDED.desired,generation=gen_random_uuid(),pending=true,kind='transfer',error=NULL")
            .bind(server).bind(node).bind(&address).execute(&mut *tx).await?;
        address
    };
    tx.commit().await?;
    Ok(Some(wings_api::GameIpv6 {
        address,
        prefix: config.prefix,
    }))
}

pub async fn status(state: &State, server: &Server) -> anyhow::Result<NetworkStatus> {
    configuration(state, server.uuid, server.node.uuid).await?;
    let row = sqlx::query("SELECT host(desired) AS address,host(applied) AS applied,pending,error,last_rotation FROM game_ipv6_servers WHERE server_uuid=$1")
        .bind(server.uuid).fetch_optional(state.database.read()).await?;
    let Some(row) = row else {
        return Ok(NetworkStatus {
            address: None,
            applied_address: None,
            pending: false,
            retry_after_seconds: 0,
            error: Some("The node has no game IPv6 prefix configured".into()),
        });
    };
    let rotated: Option<chrono::DateTime<chrono::Utc>> = row.try_get("last_rotation")?;
    Ok(NetworkStatus {
        address: row.try_get("address")?,
        applied_address: row.try_get("applied")?,
        pending: row.try_get("pending")?,
        error: row.try_get("error")?,
        retry_after_seconds: rotated
            .map(|t| {
                (t + chrono::Duration::hours(24) - chrono::Utc::now())
                    .num_seconds()
                    .max(0)
            })
            .unwrap_or(0),
    })
}

fn rotation_allowed(
    admin: bool,
    last: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> bool {
    admin || last.is_none_or(|time| time + chrono::Duration::hours(24) <= now)
}

pub async fn rotate(
    state: &State,
    server: &Server,
    admin: bool,
    manual: Option<&str>,
) -> anyhow::Result<()> {
    configuration(state, server.uuid, server.node.uuid).await?;
    let mut tx = state.database.write().begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(server.uuid.to_string())
        .execute(&mut *tx)
        .await?;
    sqlx::query("SELECT uuid FROM nodes WHERE uuid=$1 FOR UPDATE")
        .bind(server.node.uuid)
        .fetch_one(&mut *tx)
        .await?;
    let eligible: bool = sqlx::query_scalar(
        "SELECT node_uuid=$2 AND destination_node_uuid IS NULL FROM servers WHERE uuid=$1",
    )
    .bind(server.uuid)
    .bind(server.node.uuid)
    .fetch_one(&mut *tx)
    .await?;
    anyhow::ensure!(
        eligible,
        "Server ownership changed or a transfer is in progress"
    );
    let row = sqlx::query(
        "SELECT pending,last_rotation FROM game_ipv6_servers WHERE server_uuid=$1 FOR UPDATE",
    )
    .bind(server.uuid)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| anyhow::anyhow!("Configure and apply a game prefix before rotating"))?;
    anyhow::ensure!(
        !row.get::<bool, _>("pending"),
        "A network operation is already pending; wait for reconciliation"
    );
    let rotated: Option<chrono::DateTime<chrono::Utc>> = row.try_get("last_rotation")?;
    anyhow::ensure!(
        rotation_allowed(admin, rotated, chrono::Utc::now()),
        "IPv6 rotation is limited to once per 24 hours"
    );
    anyhow::ensure!(
        admin || manual.is_none(),
        "Only administrators may choose an address"
    );
    let config_row =
        sqlx::query("SELECT prefix::text,reserved FROM game_ipv6_nodes WHERE node_uuid=$1")
            .bind(server.node.uuid)
            .fetch_one(&mut *tx)
            .await?;
    let config = NodeNetwork {
        prefix: config_row.try_get("prefix")?,
        reserved: serde_json::from_value(config_row.try_get("reserved")?)?,
    };
    let address = reserve(&mut tx, server.uuid, server.node.uuid, &config, manual).await?;
    sqlx::query("UPDATE game_ipv6_servers SET desired=$2::inet,pending=true,generation=gen_random_uuid(),kind=$3,error=NULL WHERE server_uuid=$1")
        .bind(server.uuid).bind(address).bind(if admin { "admin" } else { "rotate" }).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(())
}

#[derive(Deserialize)]
struct Endpoint {
    addresses: Vec<String>,
}

pub async fn reconcile(state: &State, uuid: uuid::Uuid) -> anyhow::Result<()> {
    let _lock = state
        .cache
        .lock(format!("game-ipv6::{uuid}"), Some(180), Some(100))
        .await?;
    let row = sqlx::query("SELECT host(desired) AS desired,generation,pending FROM game_ipv6_servers WHERE server_uuid=$1").bind(uuid).fetch_optional(state.database.read()).await?;
    let Some(row) = row else {
        return Ok(());
    };
    let desired: String = row.try_get("desired")?;
    let generation: uuid::Uuid = row.try_get("generation")?;
    let server = Server::by_uuid_optional(&state.database, uuid).await?;
    if let Some(server) = &server {
        anyhow::ensure!(
            server.destination_node.is_none(),
            "Server transfer is in progress; IPv6 reservations retained"
        );
        // A destination node needs its own prefix and address before any network operation.
        configuration(state, uuid, server.node.uuid).await?;
        let node = server.node.fetch_cached(&state.database).await?;
        let response = node
            .api_client(&state.database)
            .await?
            .request_raw(reqwest::Method::POST, format!("api/servers/{uuid}/network"))
            .header("Accept", "application/json")
            .timeout(std::time::Duration::from_secs(140))
            .json(&serde_json::json!({"address":desired}))
            .send()
            .await?;
        anyhow::ensure!(
            response.status().is_success(),
            "Wings could not confirm IPv6 activation (HTTP {})",
            response.status()
        );
        let reply: serde_json::Value = response.json().await?;
        anyhow::ensure!(
            reply.get("address").and_then(serde_json::Value::as_str) == Some(&desired),
            "Wings returned a different IPv6 address"
        );
    }
    // Never release an old address until its original node confirms it is detached,
    // even after a transfer/deletion or an interrupted operation.
    let reservations = sqlx::query(
        "SELECT host(address) AS address,node_uuid FROM game_ipv6_addresses WHERE server_uuid=$1",
    )
    .bind(uuid)
    .fetch_all(state.database.read())
    .await?;
    for reservation in reservations {
        let address: String = reservation.try_get("address")?;
        if server.is_some() && address == desired {
            continue;
        }
        let node = Node::by_uuid_optional(&state.database, reservation.try_get("node_uuid")?)
            .await?
            .ok_or_else(|| {
                anyhow::anyhow!("Original IPv6 node is missing; reservation retained")
            })?;
        let response = node
            .api_client(&state.database)
            .await?
            .request_raw(
                reqwest::Method::GET,
                format!("api/system/game-network/{uuid}"),
            )
            .header("Accept", "application/json")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await?
            .error_for_status()?;
        let endpoints: Vec<Endpoint> = response.json().await?;
        anyhow::ensure!(
            !endpoints
                .iter()
                .any(|endpoint| endpoint.addresses.contains(&address)),
            "Old IPv6 endpoint is still attached; reservation retained"
        );
    }
    let mut tx = state.database.write().begin().await?;
    let locked =
        sqlx::query("SELECT generation FROM game_ipv6_servers WHERE server_uuid=$1 FOR UPDATE")
            .bind(uuid)
            .fetch_one(&mut *tx)
            .await?;
    anyhow::ensure!(
        locked.get::<uuid::Uuid, _>("generation") == generation,
        "Network generation changed; retry reconciliation"
    );
    if server.is_some() {
        sqlx::query("UPDATE game_ipv6_servers SET applied=desired,pending=false,error=NULL,last_rotation=CASE WHEN pending AND kind='rotate' THEN now() ELSE last_rotation END WHERE server_uuid=$1")
            .bind(uuid).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM game_ipv6_addresses WHERE server_uuid=$1 AND address<>$2::inet")
            .bind(uuid)
            .bind(&desired)
            .execute(&mut *tx)
            .await?;
    } else {
        sqlx::query("DELETE FROM game_ipv6_servers WHERE server_uuid=$1")
            .bind(uuid)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM game_ipv6_addresses WHERE server_uuid=$1")
            .bind(uuid)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn reconcile_pending(state: &State) -> anyhow::Result<()> {
    // Backfill existing services when an administrator enables their node prefix.
    let missing = sqlx::query("SELECT servers.uuid,servers.node_uuid FROM servers JOIN game_ipv6_nodes ON game_ipv6_nodes.node_uuid=servers.node_uuid LEFT JOIN game_ipv6_servers network ON network.server_uuid=servers.uuid WHERE servers.destination_node_uuid IS NULL AND (network.server_uuid IS NULL OR network.node_uuid<>servers.node_uuid) LIMIT 100")
        .fetch_all(state.database.read()).await?;
    for row in missing {
        configuration(state, row.try_get("uuid")?, row.try_get("node_uuid")?).await?;
    }
    let servers: Vec<uuid::Uuid> = sqlx::query_scalar("SELECT network.server_uuid FROM game_ipv6_servers network LEFT JOIN servers ON servers.uuid=network.server_uuid WHERE network.pending OR servers.uuid IS NULL OR network.node_uuid<>servers.node_uuid LIMIT 100")
        .fetch_all(state.database.read()).await?;
    for server in servers {
        if let Err(error) = reconcile(state, server).await {
            tracing::warn!(%server, %error, "IPv6 reconciliation pending; reservations retained");
            sqlx::query("UPDATE game_ipv6_servers SET error=$2 WHERE server_uuid=$1 AND pending")
                .bind(server)
                .bind(error.to_string())
                .execute(state.database.write())
                .await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn customer_rotation_has_a_24_hour_success_boundary_and_admins_are_unlimited() {
        let now = chrono::Utc::now();
        assert!(rotation_allowed(false, None, now));
        assert!(!rotation_allowed(
            false,
            Some(now - chrono::Duration::hours(23)),
            now
        ));
        assert!(rotation_allowed(
            false,
            Some(now - chrono::Duration::hours(24)),
            now
        ));
        assert!(rotation_allowed(true, Some(now), now));
        assert!(!rotation_allowed(false, Some(now), now));
    }

    #[test]
    fn reservations_reject_infrastructure_and_other_prefixes() {
        let bits = network_bits("2a0c:b641:620:1000::/64").unwrap();
        assert!(usable(
            bits,
            "2a0c:b641:620:1000::1234".parse().unwrap(),
            &[]
        ));
        for address in [
            "2a0c:b641:620:1000::",
            "2a0c:b641:620:1000::1",
            "2a0c:b641:620:1001::2",
            "2a0c:b641:620:1000:ffff:ffff:ffff:fffe",
        ] {
            assert!(!usable(bits, address.parse().unwrap(), &[]));
        }
        assert!(!usable(
            bits,
            "2a0c:b641:620:1000::2".parse().unwrap(),
            &["2a0c:b641:620:1000::2".into()]
        ));
        assert!(network_bits("fd00::/64").is_err());
    }
}
