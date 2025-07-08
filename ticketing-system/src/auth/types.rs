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

#[derive(Debug, Clone, Copy, Type, Serialize, Deserialize)]
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