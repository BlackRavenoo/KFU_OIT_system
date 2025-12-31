use std::fmt::Debug;

use bb8_redis::redis::{FromRedisValue, ParsingError, from_redis_value};
use serde::{Deserialize, Serialize};
use sqlx::Type;
use strum::EnumString;

#[derive(Debug, Clone, Copy, Type, Serialize, Deserialize, PartialEq, PartialOrd)]
#[serde(rename_all = "lowercase")]
#[repr(i16)]
pub enum UserRole {
    AnonymousClient = 0,
    Client = 1,
    Employee = 2,
    Moderator = 3,
    Admin = 4,
}

impl From<i16> for UserRole {
    fn from(value: i16) -> Self {
        match value {
            0 => UserRole::AnonymousClient,
            1 => UserRole::Client,
            2 => UserRole::Employee,
            3 => UserRole::Moderator,
            4 => UserRole::Admin,
            _ => {
                tracing::error!("Invalid UserRole value: {}", value);
                UserRole::Employee
            }
        }
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            UserRole::AnonymousClient => "anonym",
            UserRole::Client => "client",
            UserRole::Employee => "employee",
            UserRole::Moderator => "moderator",
            UserRole::Admin => "admin",
        };

        write!(
            f,
            "{}",
            s
        )
    }
}

impl UserRole {
    #[inline]
    pub fn has_access(&self, required_level: Self) -> bool {
        *self >= required_level
    }
}

#[derive(Debug, Type, Serialize, Deserialize, Clone, EnumString)]
#[repr(i16)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum UserStatus {
    Available = 0,
    Sick = 1,
    Vacation = 2,
    Busy = 3,
}

impl From<i16> for UserStatus {
    fn from(value: i16) -> Self {
        match value {
            0 => UserStatus::Available,
            1 => UserStatus::Sick,
            2 => UserStatus::Vacation,
            3 => UserStatus::Busy,
            _ => {
                tracing::error!("Invalid UserStatus value: {}", value);
                UserStatus::Available
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub user_id: i32,
    pub fingerprint: String
}

impl FromRedisValue for RefreshToken {
    fn from_redis_value(v: bb8_redis::redis::Value) -> Result<RefreshToken, ParsingError> {
        let json_str = from_redis_value::<String>(v)?;

        match serde_json::from_str::<Self>(&json_str) {
            Ok(v) => Ok(v),
            Err(e) => Err(ParsingError::from(format!("Failed to parse json: {}", e))),
        }
    }
}