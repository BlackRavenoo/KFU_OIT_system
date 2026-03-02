use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use garde::Validate;
use garde_actix_web::web::QsQuery;
use serde::{Deserialize, Serialize};
use sqlx::{prelude::FromRow, PgPool};

use crate::{auth::extractor::user_role::OptionalUserRoleExtractor, build_where_condition, schema::{common::{PaginationResult, SortOrder, UserId}, page::{PageId, Tag, TagId}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 10 }

fn default_page() -> PageId { 1 }

#[derive(Debug, Deserialize, Validate)]
#[garde(allow_unvalidated)]
pub struct GetPagesSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: PageId,
    #[garde(range(min = 10, max = 50))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    pub tags: Option<Vec<TagId>>,
    pub author: Option<UserId>,
    pub sort_order: Option<SortOrder>,
    pub search: Option<String>,
}

#[derive(Serialize)]
struct PageSchema {
    pub id: i32,
    pub is_public: bool,
    pub title: String,
    pub tags: Vec<Tag>,
}

#[derive(FromRow)]
struct PageWithMeta {
    pub id: i32,
    pub is_public: bool,
    pub title: String,
    pub tags: sqlx::types::Json<Vec<Tag>>,
    pub total_items: i64,
}

#[derive(thiserror::Error)]
pub enum GetPagesError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetPagesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetPagesError {}

pub async fn get_pages(
    pool: web::Data<PgPool>,
    schema: QsQuery<GetPagesSchema>,
    role: OptionalUserRoleExtractor,
) -> Result<HttpResponse, GetPagesError> {
    let schema = schema.into_inner();

    let only_public = if let Some(role) = role.0 {
        !role.has_access(crate::auth::types::UserRole::Employee)
    } else {
        true
    };

    let pages = fetch_pages(
        &pool,
        only_public,
        &schema
    )
    .await
    .context("Failed to fetch pages")?;

    let total_items = pages.first()
        .map(|meta| meta.total_items)
        .unwrap_or(0);

    let pages = pages.into_iter().map(|page| PageSchema {
        id: page.id,
        is_public: page.is_public,
        title: page.title,
        tags: page.tags.0,
    })
    .collect();

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items as u64,
        schema.page_size,
        pages
    )))
}

#[tracing::instrument(
    name = "Fetch pages from database",
    skip(pool),
)]
async fn fetch_pages(
    pool: &PgPool,
    only_public: bool,
    schema: &GetPagesSchema
) -> Result<Vec<PageWithMeta>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new("
        SELECT
            p.id,
            is_public,
            title,
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

        builder.push("title ILIKE ").push_bind(s);
    }

    if has_filters {
        builder.push(" ");
    }

    builder.push("GROUP BY p.id ORDER BY p.id ")
        .push(schema.sort_order.unwrap_or_default().as_str())
        .push(" LIMIT ")
        .push_bind(schema.page_size as i64)
        .push(" OFFSET ")
        .push_bind(schema.page_size as i64 * (schema.page - 1) as i64)
        .build_query_as::<PageWithMeta>()
        .fetch_all(pool)
        .await
}