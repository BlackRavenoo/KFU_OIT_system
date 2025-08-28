use actix_multipart::form::{bytes::Bytes, json::Json, MultipartForm};
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::{domain::{email::Email, name::Name}, schema::{common::{SortOrder, UserId}, tickets::{OrderBy, TicketId, TicketPriority, TicketStatus}}};

#[derive(Deserialize)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: String,
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
    pub description: Option<String>,
    pub author: Option<String>,
    pub author_contacts: Option<String>,
    pub status: Option<TicketStatus>,
    pub priority: Option<TicketPriority>,
    pub cabinet: Option<String>,
    pub note: Option<String>,
    pub building_id: Option<i16>,
}

#[derive(Deserialize)]
pub struct ChangeNameSchema {
    pub name: Name,
}

#[derive(Deserialize)]
pub struct ChangeEmailSchema {
    pub email: Email,
}