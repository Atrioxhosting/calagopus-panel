use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{server::GetServer, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[serde(default)]
        #[schema(default = "/")]
        root: compact_str::CompactString,

        files: Vec<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        entries: Vec<wings_api::DirectoryEntry>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.read")?;

        if server.is_ignored_subtree(&data.root) {
            return ApiResponse::error("root not found")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        }

        let request_body = wings_api::servers_server_files_stat::post::RequestBody {
            root: data.root,
            files: data.files,
        };

        let entries = match server
            .0
            .node
            .fetch_cached(&state.database)
            .await?
            .api_client(&state.database)
            .await?
            .ignoring(server.0.subuser_ignored_files.unwrap_or_default())
            .post_servers_server_files_stat(server.0.uuid, &request_body)
            .await
        {
            Ok(data) => data,
            Err(wings_api::client::ApiHttpError::Http(StatusCode::NOT_FOUND, err)) => {
                return ApiResponse::new_serialized(ApiError::new_wings_value(err))
                    .with_status(StatusCode::NOT_FOUND)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        };

        ApiResponse::new_serialized(Response {
            entries: entries.entries,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
