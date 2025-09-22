use actix_web::{web, HttpResponse, ResponseError};
use anyhow::Context;
use serde::Serialize;
use sqlx::PgPool;
use strum::IntoEnumIterator as _;

use crate::{schema::tickets::{Building, OrderBy}, utils::error_chain_fmt};

#[derive(Serialize)]
pub struct ConstsSchema {
    pub order_by: Vec<OrderBy>,
    pub buildings: Vec<Building>,
}

#[derive(thiserror::Error)]
pub enum GetConstsError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetConstsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetConstsError {}

pub async fn get_consts(pool: web::Data<PgPool>) -> Result<HttpResponse, GetConstsError> {
    let buildings = get_buildings(&pool).await
        .context("Failed to buildings")?;

    Ok(HttpResponse::Ok().json(ConstsSchema {
        order_by: OrderBy::iter().collect::<Vec<_>>(),
        buildings,
    }))
}

#[tracing::instrument(
    name = "Get buildings from database",
    skip(pool)
)]
async fn get_buildings(
    pool: &PgPool,
) -> Result<Vec<Building>, sqlx::Error> {
    sqlx::query_as!(
        Building,
        r#"
            SELECT id, code, name
            FROM buildings
            WHERE is_active
        "#
    )
    .fetch_all(pool)
    .await
}