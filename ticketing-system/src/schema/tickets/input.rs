use actix_multipart::form::{bytes::Bytes, json::Json, MultipartForm};
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::domain::description::Description;

#[derive(Deserialize)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: Description,
    pub author: String,
    pub author_contacts: String,
    pub planned_at: Option<DateTime<Utc>>,
    pub cabinet: Option<String>,
    pub building_id: i16,
}

#[derive(MultipartForm)]
pub struct CreateTicketForm {
    pub fields: Json<CreateTicketSchema>,
    pub attachments: Vec<Bytes>,
}