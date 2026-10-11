use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod allowed;

mod delete {
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, node::GetNode,
            node_device::NodeDevice, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
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
        activity_logger: GetAdminActivityLogger,
        Path((_node, device)): Path<(uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.devices")?;

        let node_device =
            match NodeDevice::by_node_uuid_device_uuid(&state.database, node.uuid, device).await? {
                Some(device) => device,
                None => {
                    return ApiResponse::error("device not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        node_device.delete(&state, ()).await?;

        activity_logger
            .log(
                "node:device.delete",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "device_uuid": node_device.device.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .nest("/allowed", allowed::router(state))
        .with_state(state.clone())
}
