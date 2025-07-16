use sqlx::PgPool;
use anyhow::anyhow;

use crate::auth::{password::{self, verify_password}, types::{User, UserRole}};

pub struct UserService {
    db_pool: PgPool,
}

impl UserService {
    pub fn new(db_pool: PgPool) -> Self {
        Self { db_pool }
    }
    
    pub async fn authenticate(&self, email: &str, password_input: String) -> anyhow::Result<User> {
        let mut user = sqlx::query_as!(
            User,
            r#"SELECT id, name, email, password_hash, role FROM users WHERE email = $1"#,
            email
        )
        .fetch_optional(&self.db_pool)
        .await?
        .ok_or_else(|| anyhow!("Пользователь не найден"))?;

        let password_hash = user.password_hash.take().unwrap_or_default();

        verify_password(password_input, &password_hash)?;
        
        Ok(user)
    }
    
    pub async fn register(&self, name: &str, email: &str, password: &str) -> anyhow::Result<i32> {
        let existing_user = sqlx::query!(
            r#"SELECT id FROM users WHERE email = $1"#,
            email
        )
        .fetch_optional(&self.db_pool)
        .await?;
        
        if existing_user.is_some() {
            return Err(anyhow!("A user with this email already exists"));
        }
        
        let password_hash = password::hash_password(password.to_string())?;
        
        let user_id = sqlx::query!(
            r#"
            INSERT INTO users (name, email, password_hash) 
            VALUES ($1, $2, $3) 
            RETURNING id
            "#,
            name,
            email,
            password_hash
        )
        .fetch_one(&self.db_pool)
        .await?
        .id;
        
        Ok(user_id)
    }

    pub async fn get_user(&self, user_id: i32) -> Result<Option<User>, sqlx::Error> {
        sqlx::query_as!(
            User,
            r#"
            SELECT id, name, email, role, NULL as password_hash
            FROM users
            WHERE id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.db_pool)
        .await
    }

    pub async fn get_user_role(&self, user_id: i32) -> Result<UserRole, sqlx::Error> {
        let role_num = sqlx::query_scalar!(
            "SELECT role FROM users
            WHERE id = $1",
            user_id
        )
        .fetch_one(&self.db_pool)
        .await?;

        Ok(UserRole::from(role_num))
    }

    pub async fn get_username(&self, user_id: i32) -> Result<String, sqlx::Error> {
        sqlx::query_scalar!(
            "SELECT name FROM users
            WHERE id = $1",
            user_id
        )
        .fetch_one(&self.db_pool)
        .await
    }

    pub async fn change_username(&self, user_id: i32, name: &str) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE users
            SET name = $1
            WHERE id = $2",
            name,
            user_id
        )
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }

    pub async fn change_email(&self, user_id: i32, email: &str) -> Result<(), sqlx::Error> {
        sqlx::query!(
            "UPDATE users
            SET email = $1
            WHERE id = $2",
            email,
            user_id
        )
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }

    pub async fn change_password(&self, user_id: i32, password: String) -> anyhow::Result<()> {
        let password_hash = password::hash_password(password)?;
        
        sqlx::query!(
            "UPDATE users
            SET password_hash = $1
            WHERE id = $2",
            password_hash,
            user_id
        )
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }
}