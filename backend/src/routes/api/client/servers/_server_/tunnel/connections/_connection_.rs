use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use axum::{
        extract::{Path, Query},
        http::StatusCode,
    };
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger},
            server_tunnel::ServerTunnelConnection,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        incoming: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "connection" = uuid::Uuid,
            description = "The connected server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "incoming" = bool, Query,
            description = "Remove the connection that reaches this server, rather than the one it reaches out on",
            example = "false",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        mut activity_logger: GetServerActivityLogger,
        Path((_server, connection)): Path<(String, uuid::Uuid)>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("connections.delete")?;

        let (src, dst) = if params.incoming {
            (connection, server.uuid)
        } else {
            (server.uuid, connection)
        };

        if !ServerTunnelConnection::delete(&state.database, src, dst).await? {
            return ApiResponse::error("connection not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        activity_logger
            .log(
                "server:tunnel.connections.delete",
                serde_json::json!({
                    "server_uuid": connection,
                    "incoming": params.incoming,
                }),
            )
            .await;

        activity_logger.server_uuid = connection;
        activity_logger
            .log(
                "server:tunnel.connections.delete",
                serde_json::json!({
                    "server_uuid": server.uuid,
                    "incoming": !params.incoming,
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
