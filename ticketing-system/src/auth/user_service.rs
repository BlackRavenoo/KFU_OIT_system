use sqlx::PgPool;
use anyhow::anyhow;

use crate::{auth::types::{AuthUser, UserRole, UserStatus}, domain::email::Email, utils::is_password_valid};

pub struct UserService {
    db_pool: PgPool,
}

impl UserService {
    pub fn new(db_pool: PgPool) -> Self {
        Self { db_pool }
    }
    
    pub async fn authenticate(&self, email: Email, password_input: String) -> anyhow::Result<AuthUser> {
        struct Row {
            pub id: i32,
            pub password_hash: String,
            pub role: UserRole,
            pub status: UserStatus,
        }

        let user = sqlx::query_as!(
            Row,
            r#"SELECT id, password_hash, role, status FROM users WHERE email = $1"#,
            email.as_ref()
        )
        .fetch_optional(&self.db_pool)
        .await?
        .ok_or_else(|| anyhow!("User not found"))?;

        if !is_password_valid(password_input.as_ref(), &user.password_hash)? {
            return Err(anyhow!("Invalid password"));
        }
        
        Ok(AuthUser {
            id: user.id,
            role: user.role,
            status: user.status
        })
    }
}