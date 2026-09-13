use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use indexmap::IndexMap;
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize, Deserialize)]
    struct ResponseStats {
        servers: i64,
        cpu: i64,
        memory: i64,
        memory_overhead: i64,
        disk: i64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        allocated: IndexMap<uuid::Uuid, ResponseStats>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.read")?;

        let allocated = state
            .cache
            .cached("nodes::capacities", 30, || async {
                let rows = sqlx::query!(
                    "SELECT
                        nodes.uuid,
                        COUNT(servers.uuid) as servers,
                        COALESCE(SUM(servers.cpu), 0)::int8 as cpu,
                        COALESCE(SUM(servers.memory), 0)::int8 as memory,
                        COALESCE(SUM(servers.memory_overhead), 0)::int8 as memory_overhead,
                        COALESCE(SUM(servers.disk), 0)::int8 as disk
                    FROM nodes
                    LEFT JOIN servers ON servers.node_uuid = nodes.uuid
                    GROUP BY nodes.uuid"
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.uuid,
                                ResponseStats {
                                    servers: row.servers.unwrap_or_default(),
                                    cpu: row.cpu.unwrap_or_default(),
                                    memory: row.memory.unwrap_or_default(),
                                    memory_overhead: row.memory_overhead.unwrap_or_default(),
                                    disk: row.disk.unwrap_or_default(),
                                },
                            )
                        })
                        .collect::<IndexMap<_, _>>(),
                )
            })
            .await?;

        ApiResponse::new_serialized(Response { allocated }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
