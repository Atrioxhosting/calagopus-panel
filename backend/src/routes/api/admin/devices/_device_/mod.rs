use super::State;
use axum::{
    extract::{Path, Request},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use shared::{
    GetState,
    models::{ByUuid, device::Device, user::GetPermissionManager},
    response::ApiResponse,
};
use utoipa_axum::{router::OpenApiRouter, routes};

mod duplicate;
mod nest_eggs;
mod nodes;
mod servers;

pub type GetDevice = shared::extract::ConsumingExtension<Device>;

pub async fn auth(
    state: GetState,
    permissions: GetPermissionManager,
    Path(device): Path<Vec<String>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let device = match device.first().map(|s| s.parse::<uuid::Uuid>()) {
        Some(Ok(id)) => id,
        _ => {
            return Ok(ApiResponse::error("invalid device uuid")
                .with_status(StatusCode::BAD_REQUEST)
                .into_response());
        }
    };

    if let Err(err) = permissions.has_admin_permission("devices.read") {
        return Ok(err.into_response());
    }

    let device = Device::by_uuid_optional(&state.database, device).await;
    let device = match device {
        Ok(Some(device)) => device,
        Ok(None) => {
            return Ok(ApiResponse::error("device not found")
                .with_status(StatusCode::NOT_FOUND)
                .into_response());
        }
        Err(err) => return Ok(ApiResponse::from(err).into_response()),
    };

    req.extensions_mut().insert(device);

    Ok(next.run(req).await)
}

mod get {
    use crate::routes::api::admin::devices::_device_::GetDevice;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{IntoAdminApiObject, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        device: shared::models::device::AdminApiDevice,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "device" = uuid::Uuid,
            description = "The device ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        device: GetDevice,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("devices.read")?;

        ApiResponse::new_serialized(Response {
            device: device.0.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

mod delete {
    use crate::routes::api::admin::devices::_device_::GetDevice;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            DeletableModel, admin_activity::GetAdminActivityLogger, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "device" = uuid::Uuid,
            description = "The device ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        device: GetDevice,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("devices.delete")?;

        device.delete(&state, ()).await?;

        activity_logger
            .log(
                "device:delete",
                serde_json::json!({
                    "uuid": device.uuid,
                    "name": device.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

mod patch {
    use crate::routes::api::admin::devices::_device_::GetDevice;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel, admin_activity::GetAdminActivityLogger, device::UpdateDeviceOptions,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "device" = uuid::Uuid,
            description = "The device ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(UpdateDeviceOptions))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        mut device: GetDevice,
        shared::Payload(data): shared::Payload<UpdateDeviceOptions>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("devices.update")?;

        match device.update(&state, data).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("device with name/source/target already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "device:update",
                serde_json::json!({
                    "uuid": device.uuid,
                    "name": device.name,
                    "description": device.description,

                    "source": device.source,
                    "target": device.target,

                    "permissions": device.permissions,
                    "user_attachable": device.user_attachable,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(delete::route))
        .routes(routes!(patch::route))
        .nest("/nest-eggs", nest_eggs::router(state))
        .nest("/nodes", nodes::router(state))
        .nest("/servers", servers::router(state))
        .nest("/duplicate", duplicate::router(state))
        .route_layer(axum::middleware::from_fn_with_state(state.clone(), auth))
        .with_state(state.clone())
}
