use std::net::IpAddr;

use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use garde::Validate;
use garde_actix_web::web::QsQuery;
use mac_address::MacAddress;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, QueryBuilder, prelude::FromRow, types::Json};

use crate::{build_where_condition, filters::IpFilter, schema::{assets::{AssetId, Model, ModelId, Status, StatusId}, common::{PaginationResult, SortOrder}}, utils::error_chain_fmt};

fn default_page_size() -> i8 { 50 }

fn default_page() -> AssetId { 1 }

#[derive(Debug, Deserialize, Validate)]
pub struct GetAssetsSchema {
    #[garde(range(min = 1))]
    #[serde(default = "default_page")]
    pub page: AssetId,
    #[garde(range(min = 10, max = 100))]
    #[serde(default = "default_page_size")]
    pub page_size: i8,
    #[garde(skip)]
    #[serde(default)]
    pub sort_order: SortOrder,
    #[garde(range(min = 1))]
    pub model_id: Option<ModelId>,
    #[garde(range(min = 1))]
    pub status: Option<StatusId>,
    #[garde(length(min = 1))]
    pub name: Option<String>,
    #[garde(length(min = 1))]
    pub serial_number: Option<String>,
    #[garde(length(min = 1))]
    pub inventory_number: Option<String>,
    #[garde(length(min = 1))]
    pub location: Option<String>,
    #[garde(length(min = 1))]
    pub assigned_to: Option<String>,
    #[garde(skip)]
    pub ip: Option<IpFilter>,
    #[garde(skip)]
    pub mac: Option<MacAddress>,
}

#[derive(thiserror::Error)]
pub enum GetAssetsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetAssetsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetAssetsError {}

#[derive(Deserialize, FromRow, Serialize)]
struct Asset {
    pub id: AssetId,
    pub name: String,
    pub description: Option<String>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub status: Json<Status>,
    pub location: Option<String>,
    pub assigned_to: Option<String>,
    pub model: Json<Model>,
    pub ip: Option<IpAddr>,
    pub mac: Option<MacAddress>,
    pub photo_key: Option<String>,
    pub commission_date: Option<DateTime<Utc>>,
    pub decommission_date: Option<DateTime<Utc>>,
}

pub async fn get_assets(
    pool: web::Data<PgPool>,
    QsQuery(schema): QsQuery<GetAssetsSchema>,
) -> Result<HttpResponse, GetAssetsError> {
    let assets = fetch_assets(
        &pool,
        &schema
    )
    .await
    .context("Failed to fetch assets from database")?;

    let total_items = get_assets_count(
        &pool,
        &schema
    )
    .await
    .context("Failed to get assets count")?;

    Ok(HttpResponse::Ok().json(PaginationResult::new_with_pagination(
        total_items,
        schema.page_size,
        assets
    )))
}

#[tracing::instrument(
    name = "Fetch assets from database",
    skip(pool)
)]
async fn fetch_assets(
    pool: &PgPool,
    schema: &GetAssetsSchema,
) -> Result<Vec<Asset>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(r#"SELECT
        a.id,
        a.name,
        a.description,
        a.serial_number,
        a.inventory_number,
        json_build_object(
            'id', ast.id,
            'name', ast.name,
            'color', ast.color
        ) AS status,
        a.location,
        a.assigned_to,
        jsonb_build_object(
            'id', am.id,
            'name', am.name,
            'category', jsonb_build_object(
                'id', ac.id,
                'name', ac.name,
                'color', ac.color,
                'notes', ac.notes
            )
        ) AS model,
        a.ip,
        a.mac,
        a.photo_key,
        a.commission_date,
        a.decommission_date
    FROM assets a
    JOIN asset_statuses ast ON a.status = ast.id
    JOIN asset_models am ON a.model_id = am.id
    JOIN asset_categories ac ON am.category = ac.id
    "#);
    
    apply_filters(&mut builder, schema);

    builder.push(" ORDER BY a.id ")
        .push(schema.sort_order.as_str())
        .push(" LIMIT ")
        .push_bind(schema.page_size as i64)
        .push(" OFFSET ")
        .push_bind(schema.page_size as i64 * (schema.page - 1) as i64)
        .build_query_as::<Asset>()
        .fetch_all(pool)
        .await
}

#[tracing::instrument(
    name = "Get assets count from database",
    skip(pool)
)]
async fn get_assets_count(
    pool: &PgPool,
    schema: &GetAssetsSchema,
) -> Result<u64, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT COUNT(*) as count
        FROM assets a "
    );

    apply_filters(&mut builder, schema);

    builder.build_query_scalar()
        .fetch_one(pool)
        .await
        .map(|count: i64| count as u64)
}

fn apply_filters<'a>(
    builder: &mut QueryBuilder<'a, Postgres>,
    schema: &'a GetAssetsSchema,
) {
    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.model_id, "model_id", "=");
    build_where_condition!(builder, has_filters, schema.status, "status", "=");
    build_where_condition!(builder, has_filters, schema.name, "a.name", ilike);
    build_where_condition!(builder, has_filters, schema.serial_number, "serial_number", ilike);
    build_where_condition!(builder, has_filters, schema.inventory_number, "inventory_number", ilike);
    build_where_condition!(builder, has_filters, schema.location, "location", ilike);
    build_where_condition!(builder, has_filters, schema.assigned_to, "assigned_to", ilike);
    build_where_condition!(builder, has_filters, schema.mac, "mac", "=");

    if let Some(filter) = &schema.ip {
        filter.apply_to_query(builder, &mut has_filters);
    }

    _ = has_filters;
}