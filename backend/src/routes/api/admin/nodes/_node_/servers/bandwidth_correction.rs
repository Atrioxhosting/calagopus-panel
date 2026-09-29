use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use serde::Deserialize;
    use shared::{
        GetState,
        models::{
            ByUuid,
            admin_activity::GetAdminActivityLogger,
            node::GetNode,
            server::Server,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        id: uuid::Uuid,
        delta_bytes: i64,
    }

    #[utoipa::path(post, path = "/", responses((status = OK, body = serde_json::Value)), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.update")?;
        let mut outcomes = Vec::new();
        let mut page = 1;
        loop {
            let servers =
                Server::by_node_uuid_with_pagination(&state.database, node.uuid, page, 100, None)
                    .await?;
            let count = servers.data.len();
            for server in servers.data {
                let id = uuid::Uuid::new_v5(&data.id, server.uuid.as_bytes());
                let result = async {
                    // Resolve the owner again for every write; a service may move
                    // while a bulk correction is in progress.
                    let current_server = Server::by_uuid(&state.database, server.uuid).await?;
                    let owner = current_server.node.fetch_cached(&state.database).await?;
                    let client = owner.api_client(&state.database).await?;
                    let current = client.get_server_bandwidth(server.uuid).await?;
                    let generation = current
                        .get("generation")
                        .and_then(|value| value.as_u64())
                        .ok_or_else(|| {
                            anyhow::anyhow!("Wings did not return an ownership generation")
                        })?;
                    client
                        .post_server_bandwidth_correction(
                            server.uuid,
                            &serde_json::json!({
                                "id": id,
                                "actor": user.uuid.to_string(),
                                "delta_bytes": data.delta_bytes,
                                "generation": generation,
                            }),
                        )
                        .await?;
                    Ok::<u64, anyhow::Error>(generation)
                }
                .await;
                match result {
                    Ok(generation) => outcomes.push(serde_json::json!({"server_uuid": server.uuid, "applied": true, "generation": generation})),
                    Err(err) => outcomes.push(serde_json::json!({"server_uuid": server.uuid, "applied": false, "error": err.to_string()})),
                }
            }
            if count < 100 {
                break;
            }
            page += 1;
        }
        activity_logger.log("node:bandwidth-correction", serde_json::json!({
            "node_uuid": node.uuid, "id": data.id, "delta_bytes": data.delta_bytes, "results": outcomes,
        })).await;
        ApiResponse::new_serialized(serde_json::json!({"results": outcomes})).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
