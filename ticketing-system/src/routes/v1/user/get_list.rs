use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_qs::actix::QsQuery;
use sqlx::PgPool;

use crate::{auth::types::{UserRole, UserStatus}, schema::common::{PaginationResult, UserId}, utils::error_chain_fmt};

#[derive(Deserialize, Debug)]
pub struct GetUsersSchema {
    pub page: Option<UserId>,
    pub page_size: Option<i8>,
    pub search: Option<String>,
    pub minimal_role: Option<UserRole>,
}

#[derive(Serialize)]
pub struct UserSchema {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub login: String,
    pub role: UserRole,
    pub status: UserStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_key: Option<String>,
}

#[derive(sqlx::FromRow)]
struct Row {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub login: String,
    pub role: UserRole,
    pub status: UserStatus,
    pub avatar_key: Option<String>,
    pub total_items: i64,
}

#[derive(thiserror::Error)]
pub enum GetUsersError {
    #[error("Page number must be greater than 0")]
    InvalidPage,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetUsersError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetUsersError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetUsersError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
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

    let rows = get_users_page(&pool, page_size, page, schema)
        .await
        .context("Failed to get users from the database")?;

    let total_items = match rows.first() {
        Some(row) => row.total_items as u64,
        None => 0,
    };

    let users = rows.into_iter().map(|r|UserSchema {
        id: r.id,
        name: r.name,
        email: r.email,
        login: r.login,
        role: r.role,
        status: r.status,
        avatar_key: r.avatar_key,
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
async fn get_users_page(pool: &PgPool, page_size: i8, page: i32, schema: GetUsersSchema) -> Result<Vec<Row>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("
            SELECT id, name, email, login, role, status, avatar_key, COUNT(*) OVER() as total_items
            FROM users
            WHERE is_active
        ");

    if let Some(search) = &schema.search {
        let q = format!("%{}%", search);

        builder.push(" AND (name ILIKE ").push_bind(q.clone())
            .push(" OR login ILIKE ").push_bind(q)
            .push(")");
    }

    if let Some(minimal_role) = schema.minimal_role {
        builder.push(" AND role >= ").push_bind(minimal_role as i16);
    }

    builder.push(" LIMIT ").push_bind(page_size as i64)
        .push(" OFFSET ").push_bind(page as i64 * page_size as i64);

    let query = builder.build_query_as::<Row>();

    query.fetch_all(pool).await
}