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

        let token_key = self.get_key(&token);
        
        let json_data = serde_json::to_string(&token_data)
            .context("Failed to parse json data")?;

        let user_tokens_key = self.get_user_tokens_key(token_data.user_id);

        redis::pipe()
            .set_ex(
                &token_key,
                json_data,
                self.refresh_token_ttl
            )
            .sadd(
                &user_tokens_key,
                &token_key
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
        
        let token_key = self.get_key(refresh_token);

        let token_data: Option<RefreshToken> = conn.get_del(&token_key)
            .await
            .context("Failed to get del refresh token from Redis")?;

        let token = match token_data {
            Some(token) => token,
            None => return Err(TokenStoreError::TokenNotFound),
        };

        if token.fingerprint != fingerprint {
            self.revoke_all_user_tokens(token.user_id, None, Some(conn)).await?;

            tracing::warn!(
                "Fingerprint mismatch for user {}, expected: {}, got {}. All tokens revoked.",
                token.user_id, token.fingerprint, fingerprint
            );

            return Err(TokenStoreError::FingerprintMismatch);
        }

        conn.srem::<_, _, ()>(
            self.get_user_tokens_key(token.user_id),
            &token_key
        )
        .await
        .context("Failed to remove refresh token from a set")?;
        
        Ok(token)
    }

    pub async fn revoke_all_user_tokens(&self, user_id: i32, except_token: Option<&str>, conn: Option<PooledConnection<'_, RedisConnectionManager>>) -> Result<(), TokenStoreError> {
        let mut conn = conn.unwrap_or(self.get_connection().await?);

        let user_tokens_key = self.get_user_tokens_key(user_id);

        let mut tokens: Vec<String> = conn.smembers(&user_tokens_key)
            .await
            .context("Failed to get set members from Redis")?;

        if let Some(except_token) = except_token {
            let except_token_key = self.get_key(except_token);
            tokens = tokens.into_iter()
                .filter(|token| token != &except_token_key)
                .collect();
        }

        if !tokens.is_empty() {
            redis::pipe()
                .unlink(tokens)
                .unlink(user_tokens_key)
                .exec_async(&mut *conn)
                .await
                .context("Failed to delete all user tokens")?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::auth::{token_store::TokenStoreError, types::RefreshToken};

    use super::TokenStore;
    use bb8_redis::{RedisConnectionManager, bb8::Pool, redis::AsyncCommands};
    use claims::assert_ok;

    async fn create_test_pool() -> Pool<RedisConnectionManager> {
        let manager = RedisConnectionManager::new("redis://127.0.0.1:6379")
            .expect("Failed to create Redis manager");

        Pool::builder()
            .build(manager)
            .await
            .unwrap()
    }

    async fn cleanup_redis(pool: &Pool<RedisConnectionManager>, user_id: i32) {
        let mut conn = pool.get().await.unwrap();

        conn.del::<_, ()>(format!("user_tokens:{}", user_id))
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn test_revoke_all_except_one() {
        let pool = create_test_pool().await;
        let store = TokenStore::new(pool.clone());

        cleanup_redis(&pool, 999999).await;
        
        let token_data = RefreshToken {
            user_id: 999999,
            fingerprint: "fingerprint".to_string(),
        };

        let token1 = store.generate_refresh_token(&token_data).await.unwrap();
        let token2 = store.generate_refresh_token(&token_data).await.unwrap();
        let token3 = store.generate_refresh_token(&token_data).await.unwrap();

        store.revoke_all_user_tokens(999999, Some(&token2), None).await.unwrap();

        let result = store.get_del_refresh_token(&token2, "fingerprint").await;
        assert!(result.is_ok());

        let result = store.get_del_refresh_token(&token1, "fingerprint").await;
        assert!(matches!(result, Err(TokenStoreError::TokenNotFound)));
        
        let result = store.get_del_refresh_token(&token3, "fingerprint").await;
        assert!(matches!(result, Err(TokenStoreError::TokenNotFound)));

        cleanup_redis(&pool, 999999).await;
    }

    #[tokio::test]
    async fn test_get_del_removes_token_completely() {
        let pool = create_test_pool().await;
        let store = TokenStore::new(pool.clone());

        cleanup_redis(&pool, 888888).await;
        
        let token_data = RefreshToken {
            user_id: 888888,
            fingerprint: "fingerprint".to_string(),
        };

        let token1 = store.generate_refresh_token(&token_data).await.unwrap();
        let token2 = store.generate_refresh_token(&token_data).await.unwrap();
        let token3 = store.generate_refresh_token(&token_data).await.unwrap();

        let mut conn = pool.get().await.unwrap();
        let user_tokens_key = format!("user_tokens:{}", 888888);
        
        let tokens_before: Vec<String> = conn.smembers(&user_tokens_key).await.unwrap();
        assert_eq!(tokens_before.len(), 3);
        
        let token1_key = store.get_key(&token1);
        let exists_before: bool = conn.exists(&token1_key).await.unwrap();
        assert!(exists_before);

        let result = store.get_del_refresh_token(&token1, "fingerprint").await;
        assert_ok!(result);

        let exists_after: bool = conn.exists(&token1_key).await.unwrap();
        assert!(!exists_after);

        let tokens_after: Vec<String> = conn.smembers(&user_tokens_key).await.unwrap();
        assert_eq!(tokens_after.len(), 2);
        assert!(!tokens_after.contains(&token1_key));

        let token2_key = store.get_key(&token2);
        let token3_key = store.get_key(&token3);
        assert!(tokens_after.contains(&token2_key));
        assert!(tokens_after.contains(&token3_key));

        let result = store.get_del_refresh_token(&token1, "fingerprint").await;
        assert!(matches!(result, Err(TokenStoreError::TokenNotFound)));

        let result2 = store.get_del_refresh_token(&token2, "fingerprint").await;
        assert!(result2.is_ok());

        cleanup_redis(&pool, 888888).await;
    }
}