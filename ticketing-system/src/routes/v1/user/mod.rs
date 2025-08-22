use actix_web::{web, HttpResponse, Responder};
use serde_qs::actix::QsQuery;
use sqlx::PgPool;

use crate::{auth::extractor::UserId, schema::{tickets::TicketStatus, user::{GetUsersSchema, UserSchema, UserStats}}};

pub mod invite;
pub mod change_user_status;

pub async fn get_stats(
    user_id: UserId,
    pool: web::Data<PgPool>,
) -> impl Responder {
    match sqlx::query_as!(
        UserStats,
        r#"
            SELECT
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $1), 0) AS "active_tickets_count!",
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $2), 0) AS "closed_tickets_count!",
                COALESCE(COUNT(t.id) FILTER (WHERE t.status = $3), 0) AS "cancelled_tickets_count!"
            FROM tickets t
            LEFT JOIN tickets_users tu ON t.id = tu.ticket_id
            WHERE tu.assigned_to = $4
        "#,
        TicketStatus::InProgress as i16,
        TicketStatus::Closed as i16,
        TicketStatus::Cancelled as i16,
        user_id.0
    )
    .fetch_one(pool.as_ref())
    .await {
        Ok(stats) => HttpResponse::Ok().json(stats),
        Err(e) => {
            tracing::error!("Failed to get user stats: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}

pub async fn get_users(
    schema: QsQuery<GetUsersSchema>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let schema = schema.into_inner();
    
    let page_size = schema.page_size
        .map(|size| size.clamp(10, 50))
        .unwrap_or(10) as i64;

    let page = schema.page.unwrap_or(1) - 1;

    match sqlx::query_as!(
        UserSchema,
        r#"
            SELECT id, name, email, role
            FROM users
            LIMIT $1 OFFSET $2
        "#,
        page_size,
        page as i64 * page_size
    )
    .fetch_all(pool.as_ref())
    .await {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(e) => {
            tracing::error!("Failed to get list of users: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}