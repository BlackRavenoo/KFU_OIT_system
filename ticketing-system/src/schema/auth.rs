use serde::{Deserialize, Serialize};

use crate::{auth::types::UserRole, domain::email::Email, schema::common::UserId};

// Input

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
    pub fingerprint: String
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: Email,
    pub password: String,
    pub fingerprint: String
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
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: UserRole
}