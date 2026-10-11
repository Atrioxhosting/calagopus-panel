use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger, Server},
            server_tunnel::{
                CreateServerTunnelPortOptions, ServerTunnel, ServerTunnelConnection,
                ServerTunnelPort,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        ports: Vec<CreateServerTunnelPortOptions>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("connections.update")?;

        if ServerTunnel::by_server_uuid(&state.database, server.uuid)
            .await?
            .is_none()
        {
            return ApiResponse::error("this server is not on the private network")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let settings = state.settings.get().await?;
        if data.ports.len() > settings.server.max_tunnel_port_count as usize {
            return ApiResponse::error("maximum number of private network ports reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }
        drop(settings);

        let mut seen = std::collections::HashSet::new();
        if !data.ports.iter().all(|port| seen.insert(port.port)) {
            return ApiResponse::error("the same port was listed more than once")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let peers = ServerTunnelConnection::peers(&state.database, server.uuid, true, &[]).await?;
        let mut peer_ports = Server::allocation_ports_by_uuids(
            &state.database,
            &peers
                .iter()
                .map(|peer| peer.server_uuid)
                .collect::<Vec<_>>(),
        )
        .await?;

        for peer in peers {
            let colliding = peer_ports
                .remove(&peer.server_uuid)
                .unwrap_or_default()
                .into_iter()
                .find(|port| seen.contains(port));

            if let Some(port) = colliding {
                return ApiResponse::error(format!(
                    "port {port} is already used by {}, which is connected to this server; it cannot host a connection on a port it binds itself",
                    peer.server_name
                ))
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
        }

        ServerTunnelPort::replace(&state.database, server.uuid, &data.ports).await?;

        activity_logger
            .log(
                "server:tunnel.ports.update",
                serde_json::json!({
                    "ports": data.ports.iter().map(|port| port.port).collect::<Vec<_>>(),
                }),
            )
            .await;

        shared::tunnel::poke_nodes(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .with_state(state.clone())
}
