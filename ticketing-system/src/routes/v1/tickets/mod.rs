use actix_web::{web, HttpResponse, Responder};
use sqlx::PgPool;

use crate::{schema::{tickets::{TicketId, TicketQueryResult, TicketSchemaWithAttachments}}, services::image::{ImageService, ImageType}, utils::cleanup_images};

pub mod get_tickets;
pub mod unassign_ticket;
pub mod assign_ticket;
pub mod update_ticket;
pub mod consts;
pub mod create_ticket;

pub use get_tickets::get_tickets;
pub use unassign_ticket::unassign_ticket;
pub use assign_ticket::assign_ticket;
pub use update_ticket::update_ticket;
pub use consts::get_consts;
pub use create_ticket::create_ticket;

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