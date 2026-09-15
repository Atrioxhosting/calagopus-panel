use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::{body::Bytes, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser, avatar},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        avatar: String,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), request_body = String)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut user: GetUser,
        activity_logger: GetUserActivityLogger,
        image: Bytes,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.avatar")?;

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        let data = avatar::transcode(image, avatar::upload_limits(), true).await?;

        tokio::spawn(async move {
            let avatar_path = user.store_avatar(&state, data).await?;

            activity_logger
                .log("account:update-avatar", serde_json::json!({}))
                .await;

            ApiResponse::new_serialized(Response {
                avatar: state.storage.retrieve_urls().await?.get_url(&avatar_path),
            })
            .ok()
        })
        .await?
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid,
            user::{GetPermissionManager, GetUser, User},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.avatar")?;

        tokio::spawn(async move {
            let avatar = match &user.avatar {
                Some(avatar) => avatar,
                None => {
                    return ApiResponse::error("no avatar to delete")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            };

            state.storage.remove(Some(avatar)).await?;

            sqlx::query!(
                "UPDATE users
                SET avatar = NULL
                WHERE users.uuid = $1",
                user.uuid
            )
            .execute(state.database.write())
            .await?;

            User::invalidate_cached(&state.database, user.uuid).await;

            activity_logger
                .log("account:delete-avatar", serde_json::json!({}))
                .await;

            ApiResponse::new_serialized(Response {}).ok()
        })
        .await?
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
