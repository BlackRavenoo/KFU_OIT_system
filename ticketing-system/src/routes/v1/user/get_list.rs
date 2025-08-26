use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_qs::actix::QsQuery;
use sqlx::PgPool;

use crate::{auth::types::UserRole, schema::common::{PaginationResult, UserId}, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct GetUsersSchema {
    pub page: Option<UserId>,
    pub page_size: Option<i8>,
}

#[derive(Serialize)]
pub struct UserSchema {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: UserRole,
}

struct Row {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: UserRole,
    pub total_items: i64,
}

#[derive(thiserror::Error)]
pub enum GetUsersError {
    #[error("Page number must be greater than 0")]
    InvalidPage,
    #[error(transparent)]
    UnexpectedError(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetUsersError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetUsersError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetUsersError::UnexpectedError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            GetUsersError::InvalidPage => StatusCode::BAD_REQUEST,
        }
    }
}

pub async fn get_users(
    schema: QsQuery<GetUsersSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, GetUsersError> {
    let schema = schema.into_inner();
    
    let page_size = schema.page_size
        .map(|size| size.clamp(10, 50))
        .unwrap_or(10);

    let page = schema.page.unwrap_or(1) - 1;

    if page < 0 {
        return Err(GetUsersError::InvalidPage)
    }

    let rows = get_users_page(&pool, page_size, page)
        .await
        .context("Failed to get users from the database")?;

    let total_items = match rows.first() {
        Some(ticket) => ticket.total_items as u64,
        None => return Ok(HttpResponse::NotFound().finish()),
    };

    let users = rows.into_iter().map(|r|UserSchema {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
    }).collect();

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items,
        page_size,
        users
    )))
}

#[tracing::instrument(
    name = "Get page of users from the database",
    skip(pool)
)]
async fn get_users_page(pool: &PgPool, page_size: i8, page: i32) -> Result<Vec<Row>, sqlx::Error> {
    sqlx::query_as!(
        Row,
        r#"
            SELECT id, name, email, role, COUNT(*) OVER() as "total_items!"
            FROM users
            LIMIT $1 OFFSET $2
        "#,
        page_size as i64,
        page as i64 * page_size as i64
    )
    .fetch_all(pool)
    .await
}