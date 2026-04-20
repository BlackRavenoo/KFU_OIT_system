use anyhow::Context;
use bb8_redis::{
    bb8::{Pool, PooledConnection},
    redis::{self, AsyncCommands},
    RedisConnectionManager,
};

use crate::schema::action_token::{ActionTokenKind, ActionTokenName};

pub struct ActionTokenStore {
    redis_pool: Pool<RedisConnectionManager>,
    default_ttl: u64,
}

impl ActionTokenStore {
    pub fn new(redis_pool: Pool<RedisConnectionManager>) -> Self {
        Self {
            redis_pool,
            default_ttl: 60 * 60 * 24,
        }
    }

    fn token_key(&self, action: ActionTokenKind, token: &str) -> String {
        format!("action_tokens:{}:{}", action.as_str(), token)
    }

    fn payload_key(&self, action: ActionTokenKind, payload: &str) -> String {
        format!("payload_to_token:{}:{}", action.as_str(), payload)
    }

    async fn get_connection(
        &self,
    ) -> Result<PooledConnection<'_, RedisConnectionManager>, anyhow::Error> {
        self.redis_pool
            .get()
            .await
            .context("Failed to get Redis connection")
    }

    pub async fn save(
        &self,
        action: ActionTokenKind,
        token: &str,
        payload: &str,
        ttl: Option<u64>,
    ) -> Result<(), anyhow::Error> {
        let mut con = self.get_connection().await?;
        let ttl = ttl.unwrap_or(self.default_ttl);

        redis::pipe()
            .set_ex(self.token_key(action, token), payload, ttl)
            .set_ex(self.payload_key(action, payload), token, ttl)
            .exec_async(&mut *con)
            .await
            .context("Failed to save action token")?;

        Ok(())
    }

    pub async fn get_payload(
        &self,
        action: ActionTokenKind,
        token: &str,
    ) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let payload = con
            .get(self.token_key(action, token))
            .await
            .context("Failed to get action payload by token")?;

        Ok(payload)
    }

    pub async fn get_token(
        &self,
        action: ActionTokenKind,
        payload: &str,
    ) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let token = con
            .get(self.payload_key(action, payload))
            .await
            .context("Failed to get action token by payload")?;

        Ok(token)
    }

    pub async fn get_del_payload(
        &self,
        action: ActionTokenKind,
        token: &str,
    ) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let payload: Option<String> = con
            .get(self.token_key(action, token))
            .await
            .context("Failed to get action payload by token")?;

        if let Some(payload) = payload.as_deref() {
            let res = redis::pipe()
                .get_del(self.token_key(action, token))
                .del(self.payload_key(action, payload))
                .query_async::<(Option<String>, ())>(&mut *con)
                .await
                .context("Failed to delete action token")?;

            Ok(res.0)
        } else {
            Ok(None)
        }
    }
}
