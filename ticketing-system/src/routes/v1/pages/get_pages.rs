use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use serde_qs::actix::QsQuery;
use sqlx::{prelude::FromRow, PgPool};

use crate::{auth::extractor::user_role::OptionalUserRoleExtractor, build_where_condition, schema::{common::{PaginationResult, SortOrder, UserId}, page::{PageId, Tag, TagId}}, utils::error_chain_fmt};

#[derive(Debug, Deserialize)]
pub struct GetPagesSchema {
    pub page: Option<PageId>,
    pub page_size: Option<i8>,
    pub tags: Option<Vec<TagId>>,
    pub author: Option<UserId>,
    pub sort_order: Option<SortOrder>,
    pub search: Option<String>,
}

#[derive(Serialize)]
pub struct PageSchema {
    pub id: i32,
    pub is_public: bool,
    pub title: String,
    pub key: String,
    pub tags: Vec<Tag>,
}

#[derive(FromRow)]
pub struct PageWithMeta {
    pub id: i32,
    pub is_public: bool,
    pub title: String,
    pub key: String,
    pub tags: sqlx::types::Json<Vec<Tag>>,
    pub total_items: i64,
}

#[derive(thiserror::Error)]
pub enum GetPagesError {
    #[error("Page number must be greater than 0")]
    InvalidPage,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetPagesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetPagesError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetPagesError::InvalidPage => StatusCode::BAD_REQUEST,
            GetPagesError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn get_pages(
    pool: web::Data<PgPool>,
    schema: QsQuery<GetPagesSchema>,
    role: OptionalUserRoleExtractor,
) -> Result<HttpResponse, GetPagesError> {
    let schema = schema.into_inner();
    
    let page_size = schema.page_size
        .map(|size| size.clamp(10, 50))
        .unwrap_or(10);

    let page = schema.page.unwrap_or(1) - 1;

    if page < 0 {
        return Err(GetPagesError::InvalidPage)
    }

    let only_public = if role.0.is_none() {
        true
    } else {
        false
    };

    let pages = fetch_pages(&pool, page, page_size, only_public, schema).await
        .context("Failed to fetch pages")?;

    let total_items = pages.first()
        .map(|meta| meta.total_items)
        .unwrap_or(0);

    let pages = pages.into_iter().map(|page| PageSchema {
        id: page.id,
        is_public: page.is_public,
        title: page.title,
        key: page.key,
        tags: page.tags.0,
    })
    .collect();

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items as u64,
        page_size,
        pages
    )))
}

#[tracing::instrument(
    name = "Fetch pages from database",
    skip(pool),
)]
async fn fetch_pages(
    pool: &PgPool,
    page: i32,
    page_size: i8,
    only_public: bool,
    schema: GetPagesSchema
) -> Result<Vec<PageWithMeta>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("
        SELECT
            p.id,
            is_public,
            title,
            key,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', t.id,
                        'name', t.name
                    )
                ) FILTER (WHERE t.id IS NOT NULL), 
                '[]'::json
            ) as tags,
            COUNT(*) OVER() as total_items
        FROM pages p
        LEFT JOIN pages_tags pt ON p.id = pt.page_id
        LEFT JOIN tags t ON pt.tag_id = t.id
    ");
    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.author, "author", "=");
    build_where_condition!(builder, has_filters, schema.tags, "t.id", in);
    
    if only_public {
        build_where_condition!(@add_where_and builder, has_filters);
        builder.push("is_public ");
    }

    if let Some(s) = &schema.search {
        build_where_condition!(@add_where_and builder, has_filters);
        let s = format!("%{}%", s);

        builder.push("(title ILIKE ").push_bind(s.clone())
            .push(" OR text ILIKE ").push_bind(s)
            .push(")");
    }

    if has_filters {
        builder.push(" ");
    }

    builder.push("GROUP BY p.id ORDER BY p.id ")
        .push(schema.sort_order.unwrap_or_default().as_str())
        .push(" LIMIT ")
        .push_bind(page_size as i64)
        .push(" OFFSET ")
        .push_bind(page_size as i64 * page as i64)
        .build_query_as::<PageWithMeta>()
        .fetch_all(pool)
        .await
}