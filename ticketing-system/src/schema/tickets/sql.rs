use chrono::{DateTime, Utc};

use crate::schema::tickets::{TicketId, TicketPriority, TicketStatus};

#[derive(Debug)]
pub struct TicketQueryResult {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub assigned_to_id: Option<Vec<i32>>,
    pub assigned_to_name: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub attachments: Option<Vec<String>>,
    pub building_id: i16,
    pub building_code: String,
    pub building_name: String,
    pub note: Option<String>,
    pub cabinet: Option<String>,
}