use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            egg_configuration::DisabledFeatures,
            server::{GetServer, Server},
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        #[serde(default)]
        other: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        servers: Pagination<shared::models::server::ApiServer>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
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
        (
            "other" = bool, Query,
            description = "If true, returns servers not owned by the user (admin only)",
            example = "false",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        server: GetServer,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("connections.read")?;

        let private_network_disabled = DisabledFeatures::resolve(&state.database)
            .await?
            .private_network;

        let servers = if params.other && permissions.has_admin_permission("servers.read").is_ok() {
            Server::tunnel_available_by_not_user_uuid_with_pagination(
                &state.database,
                user.uuid,
                server.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
                &private_network_disabled,
            )
            .await
        } else {
            Server::tunnel_available_by_user_uuid_with_pagination(
                &state.database,
                user.uuid,
                server.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
                &private_network_disabled,
            )
            .await
        }?;

        ApiResponse::new_serialized(Response {
            servers: servers
                .try_async_map(|server| server.into_api_object(&state, &user))
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
