use actix_multipart::form::{MultipartForm, bytes::Bytes, json::Json};
use actix_web::{HttpResponse, ResponseError, http::StatusCode, web};
use anyhow::Context as _;
use mac_address::MacAddress;
use serde::Deserialize;
use sqlx::{PgPool, types::ipnetwork::IpNetwork};

use crate::{schema::assets::{AssetId, ModelId, StatusId}, services::attachment::{Attachment, AttachmentService, AttachmentType}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum CreateAssetError {
    #[error("Unsupported photo format")]
    UnsupportedPhotoFormat,
    #[error("Model not exists")]
    ModelNotExists,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for CreateAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for CreateAssetError {
    fn status_code(&self) -> StatusCode {
        match self {
            CreateAssetError::UnsupportedPhotoFormat => StatusCode::UNSUPPORTED_MEDIA_TYPE,
            CreateAssetError::ModelNotExists => StatusCode::CONFLICT,
            CreateAssetError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetSchema {
    pub name: String,
    pub description: Option<String>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,
    pub status: StatusId,

    pub location: Option<String>,
    pub assigned_to: Option<String>,
    
    pub model_id: ModelId,

    pub ip: Option<IpNetwork>,
    pub mac: Option<MacAddress>,
}

#[derive(MultipartForm)]
pub struct CreateAssetForm {
    pub fields: Json<CreateAssetSchema>,
    pub photo: Option<Bytes>,
}

pub async fn create_asset(
    pool: web::Data<PgPool>,
    service: web::Data<AttachmentService>,
    MultipartForm(form): MultipartForm<CreateAssetForm>,
) -> Result<HttpResponse, CreateAssetError> {
    let key = if let Some(bytes) = form.photo {
        let attachment = Attachment::try_from(bytes)
            .map_err(|_| CreateAssetError::UnsupportedPhotoFormat)?;

        if !attachment.is_image() {
            return Err(CreateAssetError::UnsupportedPhotoFormat);
        }

        let key = service.upload(
            AttachmentType::AssetPhoto,
            attachment,
            None
        ).await
        .context("Failed to upload asset photo")?;

        Some(key)
    } else {
        None
    };

    let id = insert_asset(&pool, form.fields.0, key)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) => match db_err.constraint() {
                Some("assets_model_id_fkey") => CreateAssetError::ModelNotExists,
                _ => CreateAssetError::Unexpected(anyhow::anyhow!(db_err)),
            },
            e => CreateAssetError::Unexpected(anyhow::anyhow!(e)),
        })?;

    Ok(HttpResponse::Created().json(serde_json::json!({
        "id": id
    })))
}

#[tracing::instrument(
    name = "Insert asset into database",
    skip(pool)
)]
async fn insert_asset(
    pool: &PgPool,
    schema: CreateAssetSchema,
    photo_key: Option<String>,
) -> Result<AssetId, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO assets(model_id, status, name, description, serial_number, inventory_number, location, assigned_to, ip, mac, photo_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id",
        schema.model_id,
        schema.status as i16,
        schema.name,
        schema.description,
        schema.serial_number,
        schema.inventory_number,
        schema.location,
        schema.assigned_to,
        schema.ip,
        schema.mac,
        photo_key,
    )
    .fetch_one(pool)
    .await
    .map(|r| r.id)
}