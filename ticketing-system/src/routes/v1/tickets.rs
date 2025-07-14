use actix_web::{web, HttpResponse, Responder};
use sqlx::{Execute as _, PgPool};

use crate::{build_update_query, schema::{CreateTicketSchema, UpdateTicketSchema}};

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

pub async fn update_ticket(
    web::Json(schema): web::Json<UpdateTicketSchema>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE tickets SET ");
    let mut has_fields = false;

    build_update_query!(builder, has_fields, schema.title, "title");
    build_update_query!(builder, has_fields, schema.description, "description");
    build_update_query!(builder, has_fields, schema.author, "author");
    build_update_query!(builder, has_fields, schema.author_contacts, "author_contacts");
    build_update_query!(builder, has_fields, schema.status, "status");
    build_update_query!(builder, has_fields, schema.priority, "priority");

    if !has_fields {
        HttpResponse::BadRequest().finish();
    }

    builder.push(" WHERE id = ");
    builder.push_bind(schema.id);

    let query = builder.build();
    
    tracing::debug!("Update ticket query: {:?}", query.sql());

    match query.execute(pool.as_ref()).await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to update ticket: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}