use actix_multipart::form::{MultipartForm, bytes::Bytes, json::Json};
use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use mac_address::MacAddress;
use serde::Deserialize;
use sqlx::{PgPool, types::ipnetwork::IpNetwork};

use crate::{build_update_query, schema::assets::{AssetId, ModelId, StatusId}, services::attachment::{Attachment, AttachmentService, AttachmentType}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum UpdateAssetError {
    #[error("Unsupported photo format")]
    UnsupportedPhotoFormat,
    #[error("Model not exists")]
    ModelNotExists,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for UpdateAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for UpdateAssetError {}

fn default_remove_photo() -> bool {
    false
}

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

    #[serde(default = "default_remove_photo")]
    pub remove_photo: bool,
}

#[derive(MultipartForm)]
pub struct UpdateAssetForm {
    pub fields: Json<UpdateAssetSchema>,
    pub photo: Option<Bytes>,
}

pub async fn update_asset(
    pool: web::Data<PgPool>,
    service: web::Data<AttachmentService>,
    MultipartForm(mut form): MultipartForm<UpdateAssetForm>,
    path: web::Path<AssetId>,
) -> Result<HttpResponse, UpdateAssetError> {
    if form.photo.is_some() {
        form.fields.0.remove_photo = false;
    }

    let full_key = update(
        &pool,
        form.fields.0,
        path.into_inner()
    )
    .await
    .context("Failed to update asset")?
    .ok_or_else(|| UpdateAssetError::ModelNotExists)?;

    if let Some(bytes) = form.photo {
        let attachment = Attachment::try_from(bytes)
            .map_err(|_| UpdateAssetError::UnsupportedPhotoFormat)?;

        if !attachment.is_image() {
            return Err(UpdateAssetError::UnsupportedPhotoFormat);
        }

        let key = if let Some(key) = &full_key {
            key.split("/")
                .skip(1)
                .next()
                .context("Failed to get photo key")?
                .split(".")
                .next()
                .map(|r| r.to_string())
        } else {
            None
        };

        service.upload(
            AttachmentType::AssetPhoto,
            attachment,
            key
        ).await
        .context("Failed to upload asset photo")?;

    }

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
) -> Result<Option<Option<String>>, sqlx::Error> {
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

    if schema.remove_photo {
        if has_fields {
            builder.push(", ");
        }
        builder.push("photo_key = ").push_bind(None::<String>);
    }

    _ = has_fields;

    builder.push(" WHERE id = ")
        .push_bind(id)
        .push(" RETURNING photo_key");

    builder.build_query_scalar()
        .fetch_optional(pool)
        .await
}