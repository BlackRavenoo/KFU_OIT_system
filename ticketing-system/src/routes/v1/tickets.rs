use actix_web::{web, HttpResponse, Responder};
use sqlx::{Execute as _, PgPool};

use crate::{build_update_query, schema::tickets::{CreateTicketSchema, TicketQueryResult, TicketSchema, UpdateTicketSchema, User}};

pub async fn create_ticket(
    web::Json(ticket): web::Json<CreateTicketSchema>,
    pool: web::Data<PgPool>
) -> impl Responder {
    let result = sqlx::query!(
        r#"
        INSERT INTO tickets(title, description, author, author_contacts, planned_at)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        ticket.title,
        ticket.description,
        ticket.author,
        ticket.author_contacts,
        ticket.planned_at
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
        return HttpResponse::BadRequest().finish();
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

pub async fn delete_ticket(
    id: web::Path<i64>,
    pool: web::Data<PgPool>
) -> impl Responder {
    let id = id.into_inner();

    let result = sqlx::query!(
        r#"
        DELETE FROM tickets
        WHERE id = $1
        "#,
        id
    )
    .execute(pool.as_ref())
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to delete ticket: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn get_ticket(
    id: web::Path<i64>,
    pool: web::Data<PgPool>
) -> impl Responder {
    let id = id.into_inner();

    let result = sqlx::query_as!(
        TicketQueryResult,
        r#"
        SELECT 
            t.id,
            title,
            description,
            author,
            author_contacts,
            status,
            priority,
            planned_at,
            t.created_at,
            u.name as "assigned_to_name",
            u.id as "assigned_to_id"
        FROM tickets t
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.id = $1
        "#,
        id
    )
    .fetch_optional(pool.as_ref())
    .await;

    match result {
        Ok(Some(ticket)) => {
            let assigned_to = if let (Some(name), Some(id)) = (
                ticket.assigned_to_name,
                ticket.assigned_to_id,
            ) {
                Some(User {
                    id,
                    name,
                })
            } else {
                None
            };

            HttpResponse::Ok().json(
                TicketSchema {
                    id: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    author: ticket.author,
                    author_contacts: ticket.author_contacts,
                    status: ticket.status,
                    priority: ticket.priority,
                    planned_at: ticket.planned_at,
                    created_at: ticket.created_at,
                    assigned_to,
                }
            )
        }
        Ok(None) => {
            HttpResponse::NotFound().finish()
        },
        Err(e) => {
            tracing::error!("Failed to get ticket by id: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}