use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

pub type TagId = i32;
pub type PageId = i32;

#[derive(sqlx::Type, Serialize, Deserialize, FromRow)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
}

#[derive(sqlx::Type, Serialize, Deserialize)]
pub struct Page {
    pub id: PageId,
    pub title: String,
}