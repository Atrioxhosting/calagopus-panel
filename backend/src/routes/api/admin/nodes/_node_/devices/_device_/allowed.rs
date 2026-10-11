use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{ByUuid, device::Device, node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        allowed: Option<bool>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "device" = uuid::Uuid,
            description = "The device ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        Path((_node, device)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.read")?;

        let device = match Device::by_uuid_optional(&state.database, device).await? {
            Some(device) => device,
            None => {
                return ApiResponse::error("device not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        let allowed =
            node.fetch_allowed_sources(&state.database)
                .await
                .and_then(|allowed_sources| {
                    allowed_sources.allows_device(
                        &device.source,
                        &device.target,
                        &device.permissions,
                    )
                });

        ApiResponse::new_serialized(Response { allowed }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
