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
    
    #[error("Failed to get Redis connection")]
    PoolConnectionError,

    #[error("Other error: {0}")]
    Other(String),
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
        self.redis_pool
            .get()
            .await
            .map_err(|_| TokenStoreError::PoolConnectionError)
    }

    pub async fn generate_refresh_token(&self, token_data: &RefreshToken, conn: Option<PooledConnection<'_, RedisConnectionManager>>) -> Result<String, TokenStoreError> {
        let mut conn = conn.unwrap_or(
            self.get_connection().await?
        );
        
        let token = Uuid::new_v4().to_string();
        
        let json_data = serde_json::to_string(&token_data)
            .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        conn.set_ex::<_, _, ()>(
            self.get_key(&token), 
            json_data, 
            self.refresh_token_ttl
        )
        .await
        .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        let user_tokens_key = self.get_user_tokens_key(token_data.user_id);

        conn.sadd::<_, _, ()>(
            &user_tokens_key,
            &token
        )
        .await
        .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        conn.expire::<_, ()>(
            user_tokens_key,
            self.refresh_token_ttl as i64
        )
        .await
        .map_err(|e| TokenStoreError::Other(e.to_string()))?;
        
        Ok(token)
    }

    pub async fn rotate_refresh_token(
        &self, 
        refresh_token: &str,
        fingerprint: &str
    ) -> Result<(RefreshToken, String), TokenStoreError> {
        let mut conn = self.get_connection().await?;
        
        let token_data: Option<RefreshToken> = conn.get_del(self.get_key(refresh_token))
            .await
            .map_err(|e| TokenStoreError::Other(e.to_string()))?;

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
        .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        let token_str = self.generate_refresh_token(&token, Some(conn)).await?;
        
        Ok((token, token_str))
    }

    pub async fn revoke_all_user_tokens(&self, user_id: i32, conn: Option<PooledConnection<'_, RedisConnectionManager>>) -> Result<(), TokenStoreError> {
        let mut conn = conn.unwrap_or(self.get_connection().await?);

        let user_tokens_key = self.get_user_tokens_key(user_id);

        let tokens: Vec<String> = conn.smembers(&user_tokens_key)
            .await
            .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        redis::pipe()
            .unlink(tokens)
            .unlink(user_tokens_key)
            .exec_async(&mut *conn)
            .await
            .map_err(|e| TokenStoreError::Other(e.to_string()))?;

        Ok(())
    }
}