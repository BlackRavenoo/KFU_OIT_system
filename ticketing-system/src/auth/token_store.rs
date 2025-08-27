use actix_web::{http::StatusCode, ResponseError};
use anyhow::Context as _;
use bb8_redis::{bb8::{Pool, PooledConnection}, redis::{self, AsyncCommands}, RedisConnectionManager};
use ring::digest::{Context, SHA256};
use thiserror::Error;
use uuid::Uuid;

use crate::auth::types::RefreshToken;

pub struct TokenStore {
    redis_pool: Pool<RedisConnectionManager>,
    refresh_token_ttl: u64,
}

#[derive(Debug, Error)]
pub enum TokenStoreError {
    #[error("Token not found")]
    TokenNotFound,

    #[error("Fingerprint mismatch")]
    FingerprintMismatch,

    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl ResponseError for TokenStoreError {
    fn status_code(&self) -> StatusCode {
        match self {
            TokenStoreError::TokenNotFound => StatusCode::UNAUTHORIZED,
            TokenStoreError::FingerprintMismatch => StatusCode::FORBIDDEN,
            TokenStoreError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl TokenStore {
    pub fn new(redis_pool: Pool<RedisConnectionManager>) -> Self {
        // TODO: ttl from_config
        Self {
            redis_pool,
            refresh_token_ttl: 60 * 60 * 24 * 30,
        }
    }

    fn get_key(&self, token: &str) -> String {
        let mut context = Context::new(&SHA256);
        context.update(token.as_bytes());
        let digest = context.finish();
        let hash = hex::encode(digest.as_ref());
        format!("refresh_token:{}", hash)
    }

    fn get_user_tokens_key(&self, user_id: i32) -> String {
        format!("user_tokens:{}", user_id)
    }

    async fn get_connection(&self) -> Result<PooledConnection<'_, RedisConnectionManager>, TokenStoreError> {
        Ok(
            self.redis_pool
                .get()
                .await
                .context("Failed to get Redis connection")?
        )
    }

    pub async fn generate_refresh_token(&self, token_data: &RefreshToken) -> Result<String, TokenStoreError> {
        let mut conn = self.get_connection().await?;
        
        let token = Uuid::new_v4().to_string();
        
        let json_data = serde_json::to_string(&token_data)
            .context("Failed to parse json data")?;

        let user_tokens_key = self.get_user_tokens_key(token_data.user_id);

        redis::pipe()
            .set_ex(
                self.get_key(&token),
                json_data,
                self.refresh_token_ttl
            )
            .sadd(
                &user_tokens_key,
                &token
            )
            .expire(
                user_tokens_key,
                self.refresh_token_ttl as i64
            )
            .exec_async(&mut *conn)
            .await
            .context("Failed to insert refresh token into Redis")?;

        Ok(token)
    }

    pub async fn get_del_refresh_token(
        &self, 
        refresh_token: &str,
        fingerprint: &str
    ) -> Result<RefreshToken, TokenStoreError> {
        let mut conn = self.get_connection().await?;
        
        let token_data: Option<RefreshToken> = conn.get_del(self.get_key(refresh_token))
            .await
            .context("Failed to get del refresh token from Redis")?;

        let token = match token_data {
            Some(token) => token,
            None => return Err(TokenStoreError::TokenNotFound),
        };

        if token.fingerprint != fingerprint {
            self.revoke_all_user_tokens(token.user_id, Some(conn)).await?;

            tracing::warn!(
                "Fingerprint mismatch for user {}, expected: {}, got {}. All tokens revoked.",
                token.user_id, token.fingerprint, fingerprint
            );

            return Err(TokenStoreError::FingerprintMismatch);
        }

        conn.srem::<_, _, ()>(
            self.get_user_tokens_key(token.user_id),
            refresh_token
        )
        .await
        .context("Failed to remove refresh token from a set")?;
        
        Ok(token)
    }

    async fn revoke_all_user_tokens(&self, user_id: i32, conn: Option<PooledConnection<'_, RedisConnectionManager>>) -> Result<(), TokenStoreError> {
        let mut conn = conn.unwrap_or(self.get_connection().await?);

        let user_tokens_key = self.get_user_tokens_key(user_id);

        let tokens: Vec<String> = conn.smembers(&user_tokens_key)
            .await
            .context("Failed to get set members from Redis")?;

        redis::pipe()
            .unlink(tokens)
            .unlink(user_tokens_key)
            .exec_async(&mut *conn)
            .await
            .context("Failed to delete all user tokens")?;

        Ok(())
    }
}