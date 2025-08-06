use num_enum::FromPrimitive;
use serde::{Deserialize, Serialize};
use sqlx::Type;
use strum::EnumIter;

pub mod input;
pub mod output;
pub mod sql;

pub use input::*;
pub use output::*;
pub use sql::*;

pub type TicketId = i64;

// Common

#[derive(Serialize, Deserialize, Type, FromPrimitive)]
#[serde(rename_all = "lowercase")]
#[repr(i16)]
pub enum TicketStatus {
    #[default]
    Open = 0,
    Closed = 1,
    InProgress = 2,
    Cancelled = 3
}

#[derive(Serialize, Deserialize, Type, FromPrimitive)]
#[serde(rename_all = "lowercase")]
#[repr(i16)]
pub enum TicketPriority {
    #[default]
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3
}

#[derive(Deserialize, Clone, Copy, EnumIter, Default)]
#[serde(rename_all = "lowercase")]
pub enum OrderBy {
    #[default]
    Id = 0,
    PlannedAt = 1,
    Priority = 2,
}

impl OrderBy {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderBy::Id => "По айди",
            OrderBy::PlannedAt => "По дате",
            OrderBy::Priority => "По приоритету",
        }
    }
}

impl Serialize for OrderBy {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer
    {
        serde_json::json!({
            "name": self.as_str(),
            "id": *self as i16
        }).serialize(serializer)
    }
}