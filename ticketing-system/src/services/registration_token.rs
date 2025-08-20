use anyhow::Context;
use bb8_redis::{bb8::{Pool, PooledConnection}, redis::{self, AsyncCommands}, RedisConnectionManager};

use crate::{domain::email::Email};

pub struct RegistrationTokenStore {
    redis_pool: Pool<RedisConnectionManager>,
    token_ttl: u64
}

impl RegistrationTokenStore {
    pub fn new(redis_pool: Pool<RedisConnectionManager>) -> Self {
        Self {
            redis_pool,
            token_ttl: 60 * 60 * 24 * 7
        }
    }

    fn get_key(&self, token: &str) -> String {
        format!("reg_tokens:{}", token)
    }

    fn get_email_key(&self, email: &str) -> String {
        format!("email_to_token:{}", email)
    }

    async fn get_connection(&self) -> Result<PooledConnection<'_, RedisConnectionManager>, anyhow::Error> {
        self.redis_pool
            .get()
            .await
            .context("Failed to get Redis connection")
    }

    pub async fn save_token(&self, token: &str, email: &Email) -> Result<(), anyhow::Error> {
        let mut con = self.get_connection().await?;

        let mut pipe = redis::pipe();

        pipe.set_ex(
            self.get_key(token),
            email.as_ref(),
            self.token_ttl
        )
        .set_ex(
            self.get_email_key(email.as_ref()),
            token,
            self.token_ttl
        )
        .exec_async(&mut *con)
        .await
        .context("Failed to insert token.")?;

        Ok(())
    }

    pub async fn get_email(&self, token: &str) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let email = con.get(self.get_key(token))
            .await
            .context("Failed to get email by token.")?;

        Ok(email)
    }

    pub async fn get_token(&self, email: &Email) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let token = con.get(self.get_email_key(email.as_ref()))
            .await
            .context("Failed to get token by email.")?;

        Ok(token)
    }

    pub async fn get_del_token(&self, email: &Email) -> Result<Option<String>, anyhow::Error> {
        let mut con = self.get_connection().await?;

        let token = con.get(self.get_email_key(email.as_ref()))
            .await
            .context("Failed to get token by email.")?;

        Ok(token)
    }
}