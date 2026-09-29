use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::Deserialize;
    use shared::{
        GetState,
        models::{
            ByUuid,
            server::{GetServer, Server},
            user::{AuthMethod, GetAuthMethod, GetPermissionManager},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use sqlx::Row;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        period_id: String,
        period_start: chrono::DateTime<chrono::Utc>,
        period_end: chrono::DateTime<chrono::Utc>,
    }

    #[utoipa::path(post, path = "/", responses((status = OK, body = serde_json::Value)), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        auth: GetAuthMethod,
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("servers.update")?;
        let api_key = match &**auth {
            AuthMethod::ApiKey(api_key) => api_key,
            _ => {
                return ApiResponse::error("Paymenter delivery requires an API key")
                    .with_status(StatusCode::UNAUTHORIZED)
                    .ok();
            }
        };
        state
            .database
            .cache
            .ratelimit("paymenter:billing-period", 60, 60, api_key.uuid.to_string())
            .await?;
        if data.period_id.is_empty()
            || data.period_id.len() > 255
            || data.period_start >= data.period_end
        {
            return ApiResponse::error("invalid billing period")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut transaction = state.database.write().begin().await?;
        let row = sqlx::query("SELECT billing_period_id, billing_period_start, billing_period_end FROM servers WHERE uuid = $1 FOR UPDATE")
            .bind(server.uuid).fetch_one(&mut *transaction).await?;
        let previous_id: Option<String> = row.try_get("billing_period_id")?;
        let previous_start: Option<chrono::NaiveDateTime> = row.try_get("billing_period_start")?;
        let previous_end: Option<chrono::NaiveDateTime> = row.try_get("billing_period_end")?;
        let new_start = data.period_start.naive_utc();
        let new_end = data.period_end.naive_utc();
        if previous_id.as_deref() == Some(data.period_id.as_str()) {
            if previous_start != Some(new_start) || previous_end != Some(new_end) {
                return ApiResponse::error("period identifier conflicts with stored dates")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
        } else if previous_start.is_some_and(|start| new_start <= start) {
            return ApiResponse::error("period is older than or conflicts with the active period")
                .with_status(StatusCode::CONFLICT)
                .ok();
        } else {
            sqlx::query("UPDATE servers SET billing_period_id = $2, billing_period_start = $3, billing_period_end = $4 WHERE uuid = $1")
                .bind(server.uuid).bind(&data.period_id).bind(new_start).bind(new_end)
                .execute(&mut *transaction).await?;
        }
        transaction.commit().await?;
        Server::invalidate_cached(&state.database, server.uuid).await;
        let current = Server::by_uuid(&state.database, server.uuid).await?;
        if let Err(err) = current.sync(&state.database).await {
            tracing::error!(server = %server.uuid, error = %err, "failed to deliver Paymenter billing period to Wings");
            return ApiResponse::error(
                "period stored but Wings delivery failed; retry with the same period identifier",
            )
            .with_status(StatusCode::BAD_GATEWAY)
            .ok();
        }
        let applied = previous_id.as_deref() != Some(data.period_id.as_str());
        ApiResponse::new_serialized(
            serde_json::json!({"period_id": data.period_id, "applied": applied}),
        )
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
