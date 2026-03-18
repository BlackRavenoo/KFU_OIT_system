use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use mac_address::MacAddress;
use serde::Deserialize;
use sqlx::{PgPool, types::ipnetwork::IpNetwork};

use crate::{build_update_query, schema::assets::{AssetId, ModelId, StatusId}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum UpdateAssetError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateAssetError {}

#[derive(Debug, Deserialize)]
pub struct UpdateAssetSchema {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub serial_number: Option<Option<String>>,
    pub inventory_number: Option<Option<String>>,
    pub status: Option<StatusId>,

    pub location: Option<Option<String>>,
    pub assigned_to: Option<Option<String>>,
    
    pub model_id: Option<ModelId>,

    pub ip: Option<Option<IpNetwork>>,
    pub mac: Option<Option<MacAddress>>,
}

pub async fn update_asset(
    pool: web::Data<PgPool>,
    web::Json(schema): web::Json<UpdateAssetSchema>,
    path: web::Path<AssetId>,
) -> Result<HttpResponse, UpdateAssetError> {
    update(
        &pool,
        schema,
        path.into_inner()
    )
    .await
    .context("Failed to update asset")?;

    Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
    name = "Update asset in database",
    skip(pool)
)]
async fn update(
    pool: &PgPool,
    schema: UpdateAssetSchema,
    id: AssetId,
) -> Result<(), sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "UPDATE assets SET "
    );
    let mut has_fields = false;

    build_update_query!(builder, has_fields, schema.model_id, "model_id");
    build_update_query!(builder, has_fields, schema.status, "status");
    build_update_query!(builder, has_fields, schema.name, "name");
    build_update_query!(builder, has_fields, schema.description, "description");
    build_update_query!(builder, has_fields, schema.serial_number, "serial_number");
    build_update_query!(builder, has_fields, schema.inventory_number, "inventory_number");
    build_update_query!(builder, has_fields, schema.location, "location");
    build_update_query!(builder, has_fields, schema.assigned_to, "assigned_to");
    build_update_query!(builder, has_fields, schema.ip, "ip");
    build_update_query!(builder, has_fields, schema.mac, "mac");

    _ = has_fields;

    builder.push(" WHERE id = ").push_bind(id);

    builder.build()
        .execute(pool)
        .await?;

    Ok(())
}