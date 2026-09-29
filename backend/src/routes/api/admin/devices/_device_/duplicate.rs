use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::devices::_device_::GetDevice;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            DuplicableModel, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            device::DuplicateDeviceOptions, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        source: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        target: compact_str::CompactString,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        device: shared::models::device::AdminApiDevice,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "device" = uuid::Uuid,
            description = "The device ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        device: GetDevice,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("devices.create")?;

        let options = DuplicateDeviceOptions {
            name: data.name,
            source: data.source,
            target: data.target,
        };
        let duplicated = match DuplicableModel::duplicate(&device.0, &state, options).await {
            Ok(device) => device,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("device with name, source or target already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "device:duplicate",
                serde_json::json!({
                    "source_uuid": device.uuid,
                    "source_name": device.name,
                    "uuid": duplicated.uuid,
                    "name": duplicated.name,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            device: duplicated.into_admin_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
