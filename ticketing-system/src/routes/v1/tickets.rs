use actix_multipart::form::MultipartForm;
use actix_web::{web, HttpResponse, Responder};
use futures_util::{stream, StreamExt as _};
use serde_qs::actix::QsQuery;
use sqlx::{Execute as _, PgPool};
use strum::IntoEnumIterator;

use crate::{auth::extractor::UserId, build_update_query, build_where_condition, schema::{common::PaginationResult, tickets::{Building, ConstsSchema, CreateTicketForm, GetTicketsSchema, OrderBy, TicketId, TicketQueryResult, TicketSchema, TicketSchemaWithAttachments, TicketStatus, TicketWithMeta, UpdateTicketSchema}}, services::image::{ImageService, ImageType}, utils::cleanup_images};

pub async fn create_ticket(
    MultipartForm(ticket): MultipartForm<CreateTicketForm>,
    pool: web::Data<PgPool>,
    image_service: web::Data<ImageService>
) -> impl Responder {
    if ticket.attachments.len() > 5 {
        return HttpResponse::BadRequest().finish()
    }

    let fields = ticket.fields;

    let mut transaction = match pool.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin transaction: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let result = sqlx::query!(
        r#"
        INSERT INTO tickets(title, description, author, author_contacts, planned_at, cabinet, building_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
        fields.title,
        fields.description,
        fields.author,
        fields.author_contacts,
        fields.planned_at,
        fields.cabinet,
        fields.building_id,
    )
    .fetch_one(&mut *transaction)
    .await;

    let ticket_id = match result {
        Ok(rec) => rec.id,
        Err(e) => {
            tracing::error!("Failed to create ticket: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let attachments_len = ticket.attachments.len();

    if attachments_len == 0 {
        let resp = match transaction.commit().await {
            Ok(_) => HttpResponse::Created().finish(),
            Err(e) => {
                tracing::error!("Failed to commit transaction: {:?}", e);
                HttpResponse::InternalServerError().finish()
            },
        };

        return resp
    };

    let results = stream::iter(ticket.attachments)
        .map(|attachment| image_service.upload_image(ImageType::Attachments, attachment.data))
        .buffer_unordered(attachments_len)
        .collect::<Vec<_>>()
        .await;

    let mut keys = Vec::with_capacity(attachments_len);
    let mut has_error = false;

    for result in results {
        match result {
            Ok(file_path) => keys.push(file_path),
            Err(_) => {
                has_error = true;
            }
        }
    }

    if has_error && !keys.is_empty() {
        cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
        return HttpResponse::InternalServerError().finish()
    }
    
    match sqlx::query!(
        r#"
        INSERT INTO ticket_attachments (ticket_id, key)
        SELECT * FROM UNNEST(
            $1::BIGINT[],
            $2::VARCHAR(64)[]
        )
        "#,
        &vec![ticket_id; keys.len()],
        &keys
    )
    .execute(&mut *transaction)
    .await {
        Ok(_) => (),
        Err(e) => {
            tracing::error!("Failed to insert data into ticket_attachments: {:?}", e);
            if !keys.is_empty() {
                cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
            }
            return HttpResponse::InternalServerError().finish()
        },
    };
    
    match transaction.commit().await {
        Ok(_) => HttpResponse::Created().finish(),
        Err(e) => {
            tracing::error!("Failed to commit transaction: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
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
    build_update_query!(builder, has_fields, schema.cabinet, "cabinet");
    build_update_query!(builder, has_fields, schema.note, "note");
    build_update_query!(builder, has_fields, schema.building_id, "building_id");

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
    pool: web::Data<PgPool>,
    image_service: web::Data<ImageService>,
) -> impl Responder {
    let id = id.into_inner();

    let keys = match sqlx::query!(
        r#"
        SELECT key FROM ticket_attachments
        WHERE ticket_id = $1
        "#,
        id
    )
    .fetch_all(pool.as_ref())
    .await {
        Ok(recs) => recs.into_iter()
            .map(|rec| rec.key)
            .collect::<Vec<_>>(),
        Err(e) => {
            tracing::error!("Failed to get keys from ticket_attachments: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let result = sqlx::query!(
        r#"
        DELETE FROM tickets
        WHERE id = $1
        "#,
        id
    )
    .execute(pool.as_ref())
    .await;

    if !keys.is_empty() {
        cleanup_images(image_service.into_inner(), keys, 30, ImageType::Attachments).await;
    }

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
            ARRAY_AGG(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL) as assigned_to_id,
            ARRAY_AGG(DISTINCT u.name) FILTER (WHERE u.name IS NOT NULL) as assigned_to_name,
            t.created_at,
            ARRAY_AGG(DISTINCT ta.key) FILTER (WHERE ta.key IS NOT NULL) as attachments,
            b.id as "building_id",
            b.code as "building_code",
            b.name as "building_name",
            note,
            cabinet
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id 
        LEFT JOIN users u ON u.id = tu.assigned_to
        LEFT JOIN ticket_attachments ta ON ta.ticket_id = t.id
        JOIN buildings b ON b.id = t.building_id
        WHERE t.id = $1
        GROUP BY t.id, b.id
        "#,
        id
    )
    .fetch_optional(pool.as_ref())
    .await;

    match result {
        Ok(Some(ticket)) => {
            HttpResponse::Ok().json(
                TicketSchemaWithAttachments::from(ticket)
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
            ARRAY_AGG(DISTINCT u.id) FILTER (WHERE u.id IS NOT NULL) as assigned_to_id,
            ARRAY_AGG(DISTINCT u.name) FILTER (WHERE u.name IS NOT NULL) as assigned_to_name,
            b.id as "building_id",
            b.code as "building_code",
            b.name as "building_name",
            cabinet,
            COUNT(*) OVER() as total_items
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id 
        LEFT JOIN users u ON u.id = tu.assigned_to
        JOIN buildings b ON b.id = t.building_id
        "#
    );

    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.statuses, "status", in);
    build_where_condition!(builder, has_filters, schema.priorities, "priority", in);
    build_where_condition!(builder, has_filters, schema.planned_from, "planned_at", ">=");
    build_where_condition!(builder, has_filters, schema.planned_to, "planned_at", "<=");
    build_where_condition!(builder, has_filters, schema.buildings, "building_id", in);

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
        .push("GROUP BY t.id, b.id ORDER BY ")
        .push(order_by_column)
        .push(" ")
        .push(schema.sort_order.unwrap_or_default().as_str())
        .push(" LIMIT ")
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
                building: ticket.building,
                cabinet: ticket.cabinet
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

pub async fn get_consts(pool: web::Data<PgPool>) -> impl Responder {
    let buildings = match sqlx::query_as!(
        Building,
        r#"
            SELECT id, code, name
            FROM buildings
            WHERE is_active
        "#
    )
    .fetch_all(pool.as_ref())
    .await {
        Ok(buildings) => buildings,
        Err(e) => {
            tracing::error!("Failed to get building: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    HttpResponse::Ok().json(ConstsSchema {
        order_by: OrderBy::iter().collect::<Vec<_>>(),
        buildings,
    })
}

pub async fn assign_ticket(
    id: web::Path<TicketId>,
    user_id: UserId,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let ticket_id = id.into_inner();

    let mut transaction = match pool.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin transaction: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let res = sqlx::query!(
        r#"
            INSERT INTO tickets_users(assigned_to, ticket_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        "#,
        user_id.0.unwrap(),
        ticket_id
    )
    .execute(&mut *transaction)
    .await;

    if let Err(e) = res {
        tracing::error!("Failed to assign ticket: {:?}", e);
        return HttpResponse::InternalServerError().finish()
    }

    if let Err(e) = sqlx::query!(
        r#"
            UPDATE tickets
            SET status = $1
            WHERE id = $2 AND status = $3
        "#,
        TicketStatus::InProgress as i16,
        ticket_id,
        TicketStatus::Open as i16
    )
    .execute(&mut *transaction)
    .await {
        tracing::error!("Failed to update status: {:?}", e);
        return HttpResponse::InternalServerError().finish()
    }

    match transaction.commit().await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to commit transaction: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}

pub async fn unassign_ticket(
    id: web::Path<TicketId>,
    user_id: UserId,
    pool: web::Data<PgPool>,
) -> impl Responder {
    let ticket_id = id.into_inner();

    let mut transaction = match pool.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!("Failed to begin transaction: {:?}", e);
            return HttpResponse::InternalServerError().finish()
        },
    };

    let res = sqlx::query!(
        r#"
            DELETE FROM tickets_users
            WHERE ticket_id = $1 AND assigned_to = $2
        "#,
        ticket_id,
        user_id.0.unwrap(),
    )
    .execute(&mut *transaction)
    .await;

    if let Err(e) = res {
        tracing::error!("Failed to unassign ticket: {:?}", e);
        return HttpResponse::InternalServerError().finish()
    }

    if let Err(e) = sqlx::query!(
        r#"
            UPDATE tickets
            SET status = $1
            WHERE id = $2 AND status = $3 AND NOT EXISTS (
                SELECT 1
                FROM tickets_users tu
                WHERE tu.ticket_id = tickets.id
            )
        "#,
        TicketStatus::Open as i16,
        ticket_id,
        TicketStatus::InProgress as i16
    )
    .execute(&mut *transaction)
    .await {
        tracing::error!("Failed to update status: {:?}", e);
        return HttpResponse::InternalServerError().finish()
    }

    match transaction.commit().await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(e) => {
            tracing::error!("Failed to commit transaction: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}