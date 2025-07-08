use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub client_id: String,
    pub refresh_token: String,
    pub fingerprint: String
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RefreshToken {
    pub user_id: i32,
    pub fingerprint: String
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub fingerprint: String
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}