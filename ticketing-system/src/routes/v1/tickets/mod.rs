use actix_multipart::form::MultipartForm;
use actix_web::{web, HttpResponse, Responder};
use futures_util::{stream, StreamExt as _};
use sqlx::PgPool;
use strum::IntoEnumIterator;

use crate::{schema::{tickets::{Building, ConstsSchema, CreateTicketForm, OrderBy, TicketId, TicketQueryResult, TicketSchemaWithAttachments}}, services::image::{ImageService, ImageType}, utils::cleanup_images};

pub mod get_tickets;
pub mod unassign_ticket;
pub mod assign_ticket;
pub mod update_ticket;

pub use get_tickets::get_tickets;
pub use unassign_ticket::unassign_ticket;
pub use assign_ticket::assign_ticket;
pub use update_ticket::update_ticket;

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
        fields.description.as_ref(),
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
            t.status,
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