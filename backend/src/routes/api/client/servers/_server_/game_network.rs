use super::State;
use shared::{
    GetState,
    models::{
        game_ipv6::{self, NetworkStatus},
        server::GetServer,
        user::{GetPermissionManager, GetUser},
    },
    response::{ApiResponse, ApiResponseResult},
};
use utoipa_axum::{router::OpenApiRouter, routes};
#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Payload {
    #[serde(default)]
    address: Option<String>,
}
#[utoipa::path(get,path="/",responses((status=OK,body=NetworkStatus)))]
async fn get(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
) -> ApiResponseResult {
    permissions.has_server_permission("allocations.read")?;
    ApiResponse::new_serialized(game_ipv6::status(&state, &server).await?).ok()
}
#[utoipa::path(post,path="/",request_body=Payload,responses((status=OK,body=NetworkStatus)))]
async fn post(
    state: GetState,
    permissions: GetPermissionManager,
    server: GetServer,
    user: GetUser,
    shared::Payload(data): shared::Payload<Payload>,
) -> ApiResponseResult {
    permissions.has_server_permission("allocations.update")?;
    if let Err(error) =
        game_ipv6::rotate(&state, &server, user.admin, data.address.as_deref()).await
    {
        return ApiResponse::error(error.to_string())
            .with_status(axum::http::StatusCode::CONFLICT)
            .ok();
    }
    let state_copy = state.0.clone();
    let uuid = server.uuid;
    tokio::spawn(async move {
        if let Err(error) = game_ipv6::reconcile(&state_copy, uuid).await {
            tracing::warn!(%uuid,%error,"IPv6 rotation pending reconciliation");
        }
    });
    ApiResponse::new_serialized(game_ipv6::status(&state, &server).await?).ok()
}
pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get))
        .routes(routes!(post))
        .with_state(state.clone())
}
