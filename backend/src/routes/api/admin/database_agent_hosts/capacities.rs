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
        instances: i64,
        cpu: i64,
        memory: i64,
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
        permissions.has_admin_permission("database-agent-hosts.read")?;

        let allocated = state
            .cache
            .cached("database-agent-hosts::capacities", 30, || async {
                let rows = sqlx::query!(
                    "SELECT
                        database_agent_hosts.uuid,
                        COUNT(server_database_instances.uuid) as instances,
                        COALESCE(SUM(COALESCE(server_database_instances.cpu, database_agent_templates.cpu)), 0)::int8 as cpu,
                        COALESCE(SUM(COALESCE(server_database_instances.memory, database_agent_templates.memory)), 0)::int8 as memory,
                        COALESCE(SUM(COALESCE(server_database_instances.disk, database_agent_templates.disk)), 0)::int8 as disk
                    FROM database_agent_hosts
                    LEFT JOIN server_database_instances ON server_database_instances.database_agent_host_uuid = database_agent_hosts.uuid
                    LEFT JOIN database_agent_templates ON database_agent_templates.uuid = server_database_instances.database_agent_template_uuid
                    GROUP BY database_agent_hosts.uuid"
                )
                .fetch_all(state.database.read())
                .await?;

                Ok::<_, sqlx::Error>(
                    rows.into_iter()
                        .map(|row| {
                            (
                                row.uuid,
                                ResponseStats {
                                    instances: row.instances.unwrap_or_default(),
                                    cpu: row.cpu.unwrap_or_default(),
                                    memory: row.memory.unwrap_or_default(),
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
