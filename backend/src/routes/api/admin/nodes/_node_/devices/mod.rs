use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _device_;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, node::GetNode,
            node_device::NodeDevice, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        devices: Pagination<shared::models::node_device::AdminApiNodeDevice>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "node" = uuid::Uuid,
            description = "The node ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("nodes.devices")?;

        let devices = NodeDevice::by_node_uuid_with_pagination(
            &state.database,
            node.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            devices: devices
                .try_async_map(|device| device.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, admin_activity::GetAdminActivityLogger, node::GetNode,
            node_device::NodeDevice, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        device_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = CONFLICT, body = ApiError),
    ), params(
        (
            "node" = i32,
            description = "The node ID",
            example = "1",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.devices")?;

        let options = shared::models::node_device::CreateNodeDeviceOptions {
            node_uuid: node.uuid,
            device_uuid: data.device_uuid,
        };
        match NodeDevice::create(&state, options).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("device already exists")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "node:device.create",
                serde_json::json!({
                    "node_uuid": node.uuid,
                    "device_uuid": data.device_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{device}", _device_::router(state))
        .with_state(state.clone())
}
