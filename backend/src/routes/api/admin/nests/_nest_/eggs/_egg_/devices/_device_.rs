use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod delete {
    use crate::routes::api::admin::nests::_nest_::{GetNest, eggs::_egg_::GetNestEgg};
    use axum::{extract::Path, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, nest_egg_device::NestEggDevice,
            user::GetPermissionManager,
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
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "egg" = uuid::Uuid,
            description = "The egg ID",
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
        nest: GetNest,
        egg: GetNestEgg,
        activity_logger: GetAdminActivityLogger,
        Path((_nest, _egg, device)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("eggs.devices")?;

        let egg_device = match NestEggDevice::by_egg_uuid_device_uuid(
            &state.database,
            egg.uuid,
            device,
        )
        .await?
        {
            Some(device) => device,
            None => {
                return ApiResponse::error("device not found")
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
        };

        egg_device.delete(&state, ()).await?;

        activity_logger
            .log(
                "nest:egg.device.delete",
                serde_json::json!({
                    "nest_uuid": nest.uuid,
                    "egg_uuid": egg.uuid,
                    "device_uuid": egg_device.device.uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
