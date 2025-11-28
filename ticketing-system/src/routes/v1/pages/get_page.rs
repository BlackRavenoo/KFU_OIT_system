use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;

use crate::{auth::{extractor::user_role::OptionalUserRoleExtractor, types::UserRole}, schema::page::{Page, PageId, Tag}, utils::error_chain_fmt};

#[derive(Serialize)]
pub struct PageSchema {
    pub is_public: bool,
    pub title: String,
    pub key: String,
    pub tags: Vec<Tag>,
    pub related_pages: Vec<Page>,
}

#[derive(thiserror::Error)]
pub enum GetPageError {
    #[error("Page not found")]
    NotFound,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetPageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetPageError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetPageError::NotFound => StatusCode::NOT_FOUND,
            GetPageError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn get_page(
    pool: web::Data<PgPool>,
    id: web::Path<PageId>,
    role: OptionalUserRoleExtractor,
) -> Result<HttpResponse, GetPageError> {
    let page = fetch_page(&pool, *id).await
        .context("Failed to fetch page")?
        .ok_or(GetPageError::NotFound)?;

    let only_is_public = match role.0 {
        Some(role) => !role.has_access(UserRole::Employee),
        None => true,
    };

    if only_is_public && !page.is_public {
        return Err(GetPageError::NotFound);
    }

    Ok(HttpResponse::Ok().json(page))
}

#[tracing::instrument(
    name = "Fetch page from database",
    skip(pool)
)]
async fn fetch_page(
    pool: &PgPool,
    id: PageId,
) -> Result<Option<PageSchema>, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT
            p.id,
            p.is_public,
            p.title,
            p.key,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', t.id,
                        'name', t.name
                    )
                ) FILTER (WHERE t.id IS NOT NULL), 
                '[]'::json
            ) as "tags!",
             COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', relp.id,
                        'title', relp.title
                    )
                ) FILTER (WHERE relp.id IS NOT NULL), 
                '[]'::json
            ) as "related_pages!"
        FROM pages p
        LEFT JOIN pages_tags pt ON p.id = pt.page_id
        LEFT JOIN tags t ON pt.tag_id = t.id
        LEFT JOIN related_pages rp ON rp.source_page_id = p.id
        LEFT JOIN pages relp ON relp.id = rp.related_page_id
        WHERE p.id = $1
        GROUP BY p.id
        "#,
        id
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.map(|row| PageSchema {
        is_public: row.is_public,
        title: row.title,
        key: row.key,
        tags: serde_json::from_value(row.tags).unwrap_or_default(),
        related_pages: serde_json::from_value(row.related_pages).unwrap_or_default()
    }))
}