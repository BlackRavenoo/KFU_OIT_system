use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, FromRow, Deserialize)]
pub struct Status {
    id: StatusId,
    name: String,
    color: String,
}

#[derive(Debug, Serialize, FromRow, Deserialize, sqlx::Type)]
pub struct Category {
    id: CategoryId,
    name: String,
    color: String,
    notes: Option<String>,
}

#[derive(Debug, Serialize, FromRow, Deserialize, sqlx::Decode)]
pub struct Model {
    id: ModelId,
    name: String,
    category: Category,
}

pub type AssetId = i64;
pub type ModelId = i32;
pub type CategoryId = i16;
pub type StatusId = i16;