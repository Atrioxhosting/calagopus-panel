use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(Deserialize)]
    pub struct Params {
        build_id: Option<u64>,
        #[serde(default)]
        from_offset: u64,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        offset: u64,
        data: String,
        eof: bool,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "build_id" = Option<u64>, Query,
            description = "The build to read the log of, defaulting to the current or most recent one",
            example = "3",
        ),
        (
            "from_offset" = u64, Query,
            description = "The byte offset to resume from, taken from the previous response",
            example = "65536",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        state.ensure_extension_management()?;

        permissions.has_admin_permission("extensions.manage")?;

        match shared::heavy::ask(&shared::heavy::Request::StreamLog {
            build_id: params.build_id,
            from_offset: params.from_offset,
        })
        .await
        {
            Ok(shared::heavy::Response::LogChunk { offset, data, eof }) => {
                ApiResponse::new_serialized(Response { offset, data, eof }).ok()
            }
            Ok(shared::heavy::Response::Error { message }) => ApiResponse::error(message)
                .with_status(StatusCode::NOT_FOUND)
                .ok(),
            Ok(answer) => {
                tracing::error!("the extension supervisor answered a log request with {answer:?}");

                ApiResponse::error("the extension supervisor gave an unexpected answer")
                    .with_status(StatusCode::INTERNAL_SERVER_ERROR)
                    .ok()
            }
            Err(err) => {
                tracing::error!("the extension supervisor could not be reached: {err}");

                ApiResponse::error("the extension supervisor could not be reached")
                    .with_status(StatusCode::SERVICE_UNAVAILABLE)
                    .ok()
            }
        }
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
