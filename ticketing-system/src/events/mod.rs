pub mod event_publisher;

use chrono::{DateTime, Utc};

use crate::{domain::description::Description, schema::tickets::TicketId};

#[derive(Debug)]
pub enum Event {
    TicketCreated {
        id: TicketId,
        title: String,
        author: String,
        author_contacts: String,
        description: Description,
        planned_at: Option<DateTime<Utc>>,
        cabinet: Option<String>,
        building_name: String,
    }
}