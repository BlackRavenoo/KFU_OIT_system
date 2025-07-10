use serde::{Deserialize, Serialize};
use sqlx::Type;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub name: String,
    pub email: String,
    pub password_hash: String,
    pub role: UserRole
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub user_id: i32,
    pub fingerprint: String
}