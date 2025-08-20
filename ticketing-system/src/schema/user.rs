use serde::{Serialize, Deserialize};

use crate::{auth::types::UserRole, schema::common::UserId};

#[derive(Serialize)]
pub struct UserStats {
    pub active_tickets_count: i64,
    pub closed_tickets_count: i64,
    pub cancelled_tickets_count: i64,
}

#[derive(Deserialize)]
pub struct GetUsersSchema {
    pub page: Option<UserId>,
    pub page_size: Option<i8>,
}

#[derive(Serialize)]
pub struct UserSchema {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: UserRole,
}