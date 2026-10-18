use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            Pagination, PaginationParamsWithSearch, egg_repository_egg::EggRepositoryEgg,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct ResponseEggRepositoryEgg {
        egg: shared::models::egg_repository_egg::AdminApiEggEggRepositoryEgg,
        installed_eggs:
            Vec<shared::models::egg_repository_egg::AdminApiEggRepositoryEggInstalledEgg>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        egg_repository_eggs: Pagination<ResponseEggRepositoryEgg>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
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
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("egg-repositories.read")?;
        permissions.has_admin_permission("eggs.read")?;

        let egg_repository_eggs = EggRepositoryEgg::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let mut installed_eggs = EggRepositoryEgg::installed_eggs_by_uuids(
            &state.database,
            &egg_repository_eggs
                .data
                .iter()
                .map(|egg| egg.uuid)
                .collect::<Vec<_>>(),
        )
        .await?;

        let mut data = Vec::with_capacity(egg_repository_eggs.data.len());
        for egg_repository_egg in egg_repository_eggs.data {
            let mut eggs = Vec::new();
            for installed_egg in installed_eggs
                .remove(&egg_repository_egg.uuid)
                .unwrap_or_default()
            {
                eggs.push(installed_egg.into_admin_api_object(&state).await?);
            }

            data.push(ResponseEggRepositoryEgg {
                egg: egg_repository_egg
                    .into_admin_egg_api_object(&state, ())
                    .await?,
                installed_eggs: eggs,
            });
        }

        ApiResponse::new_serialized(Response {
            egg_repository_eggs: Pagination {
                total: egg_repository_eggs.total,
                per_page: egg_repository_eggs.per_page,
                page: egg_repository_eggs.page,
                data,
            },
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
