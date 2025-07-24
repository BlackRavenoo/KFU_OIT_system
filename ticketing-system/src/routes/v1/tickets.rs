use actix_web::{web, HttpResponse, Responder};
use sqlx::{Execute as _, PgPool};

use crate::{build_update_query, build_where_condition, schema::tickets::{CreateTicketSchema, GetTicketsSchema, TicketQueryResult, TicketSchema, UpdateTicketSchema}};

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
            HttpResponse::Ok().json(
                TicketSchema::from(ticket)
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

pub async fn get_tickets(
    web::Json(schema): web::Json<GetTicketsSchema>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        r#"SELECT 
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
        "#
    );

    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.statuses, "status", in);
    build_where_condition!(builder, has_filters, schema.priorities, "priority", in);
    build_where_condition!(builder, has_filters, schema.planned_from, "planned_from", ">=");
    build_where_condition!(builder, has_filters, schema.planned_to, "planned_to", "<=");

    if has_filters {
        builder.push("\n");
    }

    let order_by_column = match schema.order_by {
        crate::schema::tickets::OrderBy::Id => "t.id",
        crate::schema::tickets::OrderBy::PlannedAt => "planned_at",
        crate::schema::tickets::OrderBy::Priority => "priority",
    };

    builder
        .push("ORDER BY ")
        .push(order_by_column)
        .push(" ")
        .push(schema.sort_order.as_str());

    let query = builder.build_query_as::<TicketSchema>();

    match query.fetch_all(pool.as_ref()).await {
        Ok(tickets) => HttpResponse::Ok().json(tickets),
        Err(e) => {
            tracing::error!("Failed to fetch tickets: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}