use num_enum::FromPrimitive;
use serde::{Deserialize, Serialize};
use strum::EnumIter;

use crate::schema::tickets::TicketStatus;

pub type NotificationId = i32;

#[derive(Deserialize, Serialize, Clone, Copy, EnumIter, Default, FromPrimitive, Debug)]
#[serde(from = "i16")]
#[repr(i16)]
pub enum SystemNotificationCategory {
    #[default]
    Info = 0,
    Warning = 1,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum Notification {
    #[serde(rename = "new_messages")]
    NewMessages {
        count: u32,
    },
    #[serde(rename = "status_changed")]
    StatusChanged {
        new_status: TicketStatus
    },
    #[serde(rename = "mention")]
    Mention,
}