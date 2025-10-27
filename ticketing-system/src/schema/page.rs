use serde::Serialize;

pub type TagId = i16;
pub type PageId = i32;

#[derive(sqlx::Type, Serialize)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
}