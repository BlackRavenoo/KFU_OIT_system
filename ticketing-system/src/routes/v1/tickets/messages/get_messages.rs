use actix_web::{HttpResponse, ResponseError, web};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, prelude::FromRow, types::Json};

use crate::{auth::{extractor::UserRoleExtractor, types::UserRole}, schema::{common::UserId, tickets::{MessageId, TicketId}}, utils::error_chain_fmt};

fn default_limit() -> i8 { 50 }

#[derive(Deserialize, Debug)]
pub struct GetMessagesSchema {
    pub before: Option<MessageId>,
    pub after: Option<MessageId>,
    #[serde(default = "default_limit")]
    pub limit: i8,
}

#[derive(Deserialize, Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
}

#[derive(Serialize, FromRow)]
pub struct Message {
    pub id: MessageId,
    pub user: Json<User>,
    pub text: String,
    pub is_internal: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(thiserror::Error)]
pub enum GetMessagesError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for GetMessagesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetMessagesError {}

pub async fn get_messages(
    pool: web::Data<PgPool>,
    ticket_id: web::Path<TicketId>,
    web::Json(schema): web::Json<GetMessagesSchema>,
    user_role: UserRoleExtractor,
) -> Result<HttpResponse, GetMessagesError> {
    let only_not_internal = !user_role.0.has_access(UserRole::Employee);

    let messages = select_messages(
        &pool,
        &schema,
        ticket_id.into_inner(),
        only_not_internal
    ).await
    .context("Failed to get messages")?;

    Ok(HttpResponse::Ok().json(messages))
}

async fn select_messages(
    pool: &PgPool,
    schema: &GetMessagesSchema,
    ticket_id: TicketId,
    only_not_internal: bool,
) -> Result<Vec<Message>, sqlx::Error> {
    let mut builder = sqlx::QueryBuilder::new(
        "SELECT
            tm.id,
            JSON_BUILD_OBJECT(
                'id', u.id,
                'name', u.name
            ) AS user,
            message_text AS text,
            is_internal,
            tm.created_at
        FROM ticket_messages tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.ticket_id = "
    );

    builder.push_bind(ticket_id);

    if only_not_internal {
        builder.push(" AND NOT is_internal");
    }

    if let Some(after) = schema.after {
        builder.push(" AND id > ").push_bind(after);
    } else if let Some(before) = schema.before {
        builder.push(" AND id < ").push_bind(before);
    }

    builder.push("GROUP BY tm.id ORDER BY created_at DESC LIMIT")
        .push_bind(schema.limit.clamp(20, 100))
        .build_query_as::<Message>()
        .fetch_all(pool)
        .await
}