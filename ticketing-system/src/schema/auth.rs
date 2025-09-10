use serde::{Deserialize, Serialize};

use crate::domain::email::Email;

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