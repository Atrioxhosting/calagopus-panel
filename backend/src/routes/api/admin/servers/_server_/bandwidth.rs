use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses((status = OK, body = serde_json::Value)))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.read")?;
        let node = server.node.fetch_cached(&state.database).await?;
        let usage = node
            .api_client(&state.database)
            .await?
            .get_server_bandwidth(server.uuid)
            .await?;
        ApiResponse::new_serialized(usage).ok()
    }
}

mod correction {
    use axum::http::StatusCode;
    use serde::Deserialize;
    use shared::{
        GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            server::GetServer,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    const SUBTRACTION_EXCEEDS_USAGE: &str =
        "The amount to subtract cannot exceed the current bandwidth usage.";

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        id: uuid::Uuid,
        delta_bytes: i64,
    }

    #[utoipa::path(post, path = "/correction", responses((status = OK, body = serde_json::Value)), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        server: GetServer,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.update")?;
        let node = server.node.fetch_cached(&state.database).await?;
        let client = node.api_client(&state.database).await?;
        let current = client.get_server_bandwidth(server.uuid).await?;
        if data.delta_bytes < 0
            && current
                .get("used_bytes")
                .and_then(|value| value.as_u64())
                .is_some_and(|used| data.delta_bytes.unsigned_abs() > used)
        {
            return ApiResponse::error(SUBTRACTION_EXCEEDS_USAGE)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }
        let Some(generation) = current.get("generation").and_then(|value| value.as_u64()) else {
            return ApiResponse::error("Wings did not return an ownership generation")
                .with_status(StatusCode::BAD_GATEWAY)
                .ok();
        };
        let result = match client
            .post_server_bandwidth_correction(
                server.uuid,
                &serde_json::json!({
                    "id": data.id,
                    "actor": user.uuid.to_string(),
                    "delta_bytes": data.delta_bytes,
                    "generation": generation,
                }),
            )
            .await
        {
            Ok(result) => result,
            Err(wings_api::client::ApiHttpError::Http(_, error))
                if error.error == SUBTRACTION_EXCEEDS_USAGE =>
            {
                return ApiResponse::error(SUBTRACTION_EXCEEDS_USAGE)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
            Err(error) => return Err(error.into()),
        };
        activity_logger
            .log(
                "server:bandwidth-correction",
                serde_json::json!({
                    "server_uuid": server.uuid,
                    "node_uuid": node.uuid,
                    "id": data.id,
                    "delta_bytes": data.delta_bytes,
                    "generation": generation,
                }),
            )
            .await;
        ApiResponse::new_serialized(result).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(correction::route))
        .with_state(state.clone())
}
