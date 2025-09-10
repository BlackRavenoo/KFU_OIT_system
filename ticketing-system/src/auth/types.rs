use bb8_redis::redis::{from_redis_value, ErrorKind, FromRedisValue};
use serde::{Deserialize, Serialize};
use sqlx::Type;

#[derive(Debug)]
pub struct AuthUser {
    pub id: i32,
    pub role: UserRole,
    pub status: UserStatus,
}

#[derive(Debug, Clone, Copy, Type, Serialize, Deserialize, PartialEq, PartialOrd)]
#[repr(i16)]
pub enum UserRole {
    Employee = 0,
    Moderator = 1,
    Admin = 2
}

impl From<i16> for UserRole {
    fn from(value: i16) -> Self {
        match value {
            0 => UserRole::Employee,
            1 => UserRole::Moderator,
            2 => UserRole::Admin,
            _ => {
                tracing::error!("Invalid UserRole value: {}", value);
                UserRole::Employee
            }
        }
    }
}

impl UserRole {
    pub fn has_access(&self, required_level: Self) -> bool {
        *self >= required_level
    }
}

#[derive(Debug, Type, Serialize, Deserialize, Clone)]
pub enum UserStatus {
    Active = 0,
    Sick = 1,
    Vacation = 2,
    Inactive = 3,
}

impl From<i16> for UserStatus {
    fn from(value: i16) -> Self {
        match value {
            0 => UserStatus::Active,
            1 => UserStatus::Sick,
            2 => UserStatus::Vacation,
            3 => UserStatus::Inactive,
            _ => {
                tracing::error!("Invalid UserStatus value: {}", value);
                UserStatus::Inactive
            }
        }
    }
}

impl UserStatus {
    pub fn can_auth(&self) -> bool {
        !matches!(self, Self::Inactive)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub user_id: i32,
    pub fingerprint: String
}

impl FromRedisValue for RefreshToken {
    fn from_redis_value(v: &bb8_redis::redis::Value) -> bb8_redis::redis::RedisResult<Self> {
        let json_str = from_redis_value::<String>(v)?;

        match serde_json::from_str::<Self>(&json_str) {
            Ok(v) => Ok(v),
            Err(_) => Err((ErrorKind::TypeError, "Failed to parse json").into()),
        }
    }
}