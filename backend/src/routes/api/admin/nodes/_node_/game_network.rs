use super::State;
use shared::{
    GetState,
    models::{
        game_ipv6::{self, NodeNetwork},
        node::GetNode,
        user::GetPermissionManager,
    },
    response::{ApiResponse, ApiResponseResult},
};
use utoipa_axum::{router::OpenApiRouter, routes};
#[utoipa::path(get,path="/",responses((status=OK,body=Option<NodeNetwork>)))]
async fn get(
    state: GetState,
    permissions: GetPermissionManager,
    node: GetNode,
) -> ApiResponseResult {
    permissions.has_admin_permission("nodes.read")?;
    ApiResponse::new_serialized(game_ipv6::node_network(&state, node.uuid).await?).ok()
}
#[utoipa::path(put,path="/",request_body=NodeNetwork,responses((status=OK)))]
async fn put(
    state: GetState,
    permissions: GetPermissionManager,
    node: GetNode,
    shared::Payload(config): shared::Payload<NodeNetwork>,
) -> ApiResponseResult {
    permissions.has_admin_permission("nodes.update")?;
    if let Err(error) = game_ipv6::set_node_network(&state, node.uuid, config).await {
        return ApiResponse::error(error.to_string())
            .with_status(axum::http::StatusCode::CONFLICT)
            .ok();
    }
    ApiResponse::new_serialized(serde_json::json!({})).ok()
}
pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get))
        .routes(routes!(put))
        .with_state(state.clone())
}
