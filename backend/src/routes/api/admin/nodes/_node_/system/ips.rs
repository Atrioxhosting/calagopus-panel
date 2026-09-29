use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        GetState,
        models::{node::GetNode, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(wings_api::system_ips::get::Response200)),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        node: GetNode,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("nodes.read")?;

        let ips = node
            .api_client(&state.database)
            .await?
            .get_system_ips()
            .await?;

        ApiResponse::new_serialized(ips).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
