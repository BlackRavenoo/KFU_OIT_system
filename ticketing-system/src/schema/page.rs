use serde::{Deserialize, Serialize};

pub type TagId = i32;
pub type PageId = i32;

#[derive(sqlx::Type, Serialize, Deserialize)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
}