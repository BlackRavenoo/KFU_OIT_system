use actix_multipart::form::{bytes::Bytes, json::Json, MultipartForm};
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::{domain::{description::Description, email::Email, name::Name}, schema::tickets::{TicketPriority, TicketStatus}};

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

#[derive(Deserialize)]
pub struct UpdateTicketSchema {
    pub title: Option<String>,
    pub description: Option<Description>,
    pub author: Option<String>,
    pub author_contacts: Option<String>,
    pub status: Option<TicketStatus>,
    pub priority: Option<TicketPriority>,
    pub cabinet: Option<String>,
    pub note: Option<String>,
    pub building_id: Option<i16>,
}