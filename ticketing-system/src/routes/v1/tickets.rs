use actix_web::{web, HttpResponse, Responder};
use sqlx::PgPool;

use crate::schema::CreateTicketSchema;

pub async fn create_ticket(
    web::Json(ticket): web::Json<CreateTicketSchema>,
    pool: web::Data<PgPool>
) -> impl Responder {
    let result = sqlx::query!(
        r#"
        INSERT INTO tickets(title, description, author, author_contacts)
        VALUES ($1, $2, $3, $4)
        "#,
        ticket.title,
        ticket.description,
        ticket.author,
        ticket.author_contacts
    )
    .execute(pool.as_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Created().finish(),
        Err(e) => {
            tracing::error!("Failed to create ticket: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}