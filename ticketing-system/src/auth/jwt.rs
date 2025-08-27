use std::fs;

use anyhow::Context as _;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode_header, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::types::UserRole, config::AuthSettings};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub iat: i64,
    pub exp: i64,
    pub iss: String,
    pub jti: String,
    pub role: UserRole,
}

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    issuer: String,
    pub access_token_lifetime: Duration,
    validation: Validation,
}

impl JwtService {
    pub fn new(auth_settings: &AuthSettings) -> anyhow::Result<Self> {
        let private_key = fs::read(&auth_settings.private_key_path)?;
        
        let public_key = fs::read(&auth_settings.public_key_path)?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.set_issuer(&[&auth_settings.issuer]);
        
        Ok(Self {
            encoding_key: EncodingKey::from_rsa_pem(&private_key)?,
            decoding_key: DecodingKey::from_rsa_pem(&public_key)?,
            issuer: auth_settings.issuer.clone(),
            access_token_lifetime: Duration::from_std(auth_settings.access_token_lifetime)?,
            validation
        })
    }

    pub fn create_access_token(
        &self,
        user_id: i32,
        role: UserRole,
    ) -> Result<String, JwtError> {
        let now = Utc::now();
        let expiry = now + self.access_token_lifetime;
        
        let claims = Claims {
            sub: user_id.to_string(),
            exp: expiry.timestamp(),
            iat: now.timestamp(),
            iss: self.issuer.clone(),
            jti: Uuid::new_v4().to_string(),
            role
        };

        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some("default-key-1".to_string());
        
        Ok(
            jsonwebtoken::encode(&header, &claims, &self.encoding_key)
                .context("Failed to encode token.")?
        )
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, JwtError> {
        let header = decode_header(token)
            .map_err(|e| JwtError::InvalidToken(format!("Invalid header: {}", e)))?;

        let _kid = header.kid
            .ok_or_else(|| JwtError::InvalidToken("Missing kid in header".to_string()))?;

        // TODO: Implement key rotation mechanism
        let key = &self.decoding_key;

        jsonwebtoken::decode::<Claims>(token, key, &self.validation)
            .map(|data| data.claims)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    JwtError::InvalidToken("Token has expired".to_string())
                }
                _ => JwtError::InvalidToken("Failed to decode token".to_string())
            })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum JwtError {
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("Key not found: {0}")]
    KeyNotFound(String),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}