use actix_web::{web, HttpResponse, Responder};
use serde_qs::actix::QsQuery;
use sqlx::{Execute as _, PgPool};
use strum::IntoEnumIterator;

use crate::{auth::extractor::UserId, build_update_query, build_where_condition, schema::{common::PaginationResult, tickets::{CreateTicketSchema, GetTicketsSchema, OrderBy, TicketId, TicketQueryResult, TicketSchema, TicketWithMeta, UpdateTicketSchema}}};

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
    id: web::Path<TicketId>,
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
    id: web::Path<TicketId>,
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
    schema: QsQuery<GetTicketsSchema>,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let schema = schema.into_inner();
    
    let page_size = schema.page_size
        .and_then(|size| Some(size.clamp(10, 50)))
        .unwrap_or(10);

    let page = schema.page.unwrap_or(1) - 1;
        
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
            u.id as "assigned_to_id",
            COUNT(*) OVER() as total_items
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

    let order_by = schema.order_by.unwrap_or_default();

    let order_by_column = match order_by {
        crate::schema::tickets::OrderBy::Id => "t.id",
        crate::schema::tickets::OrderBy::PlannedAt => "planned_at",
        crate::schema::tickets::OrderBy::Priority => "priority",
    };

    builder
        .push("ORDER BY ")
        .push(order_by_column)
        .push(" ")
        .push(schema.sort_order.unwrap_or_default().as_str())
        .push("\n")
        .push("LIMIT ")
        .push_bind(page_size as i64)
        .push(" OFFSET ")
        .push_bind(page_size as i64 * page);

    let query = builder.build_query_as::<TicketWithMeta>();

    match query.fetch_all(pool.as_ref()).await {
        Ok(tickets) => {
            let total_items = match tickets.first() {
                Some(ticket) => ticket.total_items as u64,
                None => return HttpResponse::NotFound().finish(),
            };

            let tickets = tickets.into_iter().map(|ticket| TicketSchema {
                id: ticket.id,
                title: ticket.title,
                description: ticket.description,
                author: ticket.author,
                author_contacts: ticket.author_contacts,
                status: ticket.status,
                priority: ticket.priority,
                planned_at: ticket.planned_at,
                assigned_to: ticket.assigned_to,
                created_at: ticket.created_at,
            }).collect::<Vec<_>>();

            let res = PaginationResult::new_with_pagination(
                total_items,
                page_size,
                tickets
            );

            HttpResponse::Ok().json(res)
        },
        Err(e) => {
            tracing::error!("Failed to fetch tickets: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}

pub async fn get_order_fields() -> impl Responder {
    HttpResponse::Ok().json(OrderBy::iter().collect::<Vec<_>>())
}

pub async fn assign_ticket(
    id: web::Path<TicketId>,
    user_id: UserId,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let res = sqlx::query!(
        r#"
            UPDATE tickets SET
            assigned_to = $1
            WHERE id = $2
        "#,
        user_id.0.unwrap(),
        id.into_inner()
    )
    .execute(pool.as_ref())
    .await;

    match res {
        Ok(result) => {
            if result.rows_affected() == 0 {
                HttpResponse::NotFound().finish()
            } else {
                HttpResponse::Ok().finish()
            }
        },
        Err(e) => {
            tracing::error!("Failed to assign ticket: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}

pub async fn unassign_ticket(
    id: web::Path<TicketId>,
    user_id: UserId,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let res = sqlx::query!(
        r#"
            UPDATE tickets SET
            assigned_to = NULL
            WHERE id = $1 AND assigned_to = $2
        "#,
        id.into_inner(),
        user_id.0.unwrap(),
    )
    .execute(pool.as_ref())
    .await;

    match res {
        Ok(result) => {
            if result.rows_affected() == 0 {
                HttpResponse::NotFound().finish()
            } else {
                HttpResponse::Ok().finish()
            }
        },
        Err(e) => {
            tracing::error!("Failed to unassign ticket: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}