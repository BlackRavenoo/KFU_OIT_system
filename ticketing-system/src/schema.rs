use serde::{Deserialize, Serialize};

use crate::auth::types::UserRole;

// Input

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
    pub fingerprint: String
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub fingerprint: String
}

#[derive(Deserialize)]
pub struct CreateTicketSchema {
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
}

#[derive(Deserialize)]
pub struct UpdateTicketSchema {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub author_contacts: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
}

// Output

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Serialize)]
pub struct MeSchema {
    pub id: i32,
    pub name: String,
    pub email: String,
    pub role: UserRole
}