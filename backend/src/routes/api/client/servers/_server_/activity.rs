use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, PaginationParamsWithSearch,
            server::GetServer,
            server_activity::ServerActivity,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
        settings::activity::ActivityIpHiding,
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Params {
        user: Option<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        activities: Pagination<shared::models::server_activity::ApiServerActivity>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "user" = Option<uuid::Uuid>, Query,
            description = "The user ID to filter activities",
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
        user: GetUser,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(pagination): Query<PaginationParamsWithSearch>,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&pagination) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("activity.read")?;

        let activities = if let Some(user_uuid) = params.user {
            ServerActivity::by_server_uuid_user_uuid_with_pagination(
                &state.database,
                server.uuid,
                user_uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await?
        } else {
            ServerActivity::by_server_uuid_with_pagination(
                &state.database,
                server.uuid,
                pagination.page,
                pagination.per_page,
                pagination.search.as_deref(),
            )
            .await?
        };

        let storage_url_retriever = state.storage.retrieve_urls().await?;
        let can_read_ip = permissions
            .has_server_permission("activity.read-ip")
            .is_ok();
        let hide_ips = state
            .settings
            .get_as(|s| s.activity.server_hide_activity_ips)
            .await?;

        ApiResponse::new_serialized(Response {
            activities: activities
                .try_async_map(|activity| {
                    let is_own_activity = activity.impersonator.is_none()
                        && activity.user.as_ref().is_some_and(|u| u.uuid == user.uuid);
                    let show_ip = can_read_ip
                        && match hide_ips {
                            ActivityIpHiding::None => true,
                            ActivityIpHiding::Admins => {
                                is_own_activity
                                    || !(activity.impersonator.is_some()
                                        || activity.user.as_ref().is_some_and(|u| u.admin))
                            }
                            ActivityIpHiding::AllUsers => is_own_activity,
                        };

                    activity.into_api_object(&state, (&storage_url_retriever, show_ip))
                })
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
