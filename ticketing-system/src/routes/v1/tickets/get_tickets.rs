use actix_web::{http::StatusCode, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_qs::actix::QsQuery;
use sqlx::{FromRow, PgPool, QueryBuilder, Row};

use crate::{auth::{extractor::{UserIdExtractor, UserRoleExtractor}, types::UserRole}, build_where_condition, schema::{common::{PaginationResult, SortOrder, UserId}, tickets::{Building, OrderBy, TicketId, TicketPriority, TicketStatus}}, utils::error_chain_fmt};

#[derive(Deserialize)]
pub struct GetTicketsSchema {
    pub statuses: Option<Vec<TicketStatus>>,
    pub priorities: Option<Vec<TicketPriority>>,
    pub planned_from: Option<DateTime<Utc>>,
    pub planned_to: Option<DateTime<Utc>>,
    pub order_by: Option<OrderBy>,
    pub sort_order: Option<SortOrder>,
    pub page: Option<TicketId>,
    pub page_size: Option<i8>,
    pub buildings: Option<Vec<i16>>,
    pub assigned_to: Option<UserId>,
    pub search: Option<String>,
    pub departments: Option<Vec<i16>>,
}

pub struct TicketWithMeta {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub total_items: i64,
    pub building: Building,
    pub cabinet: Option<String>,
}

impl FromRow<'_, sqlx::postgres::PgRow> for TicketWithMeta {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            author: row.try_get("author")?,
            author_contacts: row.try_get("author_contacts")?,
            status: row.try_get("status")?,
            priority: row.try_get("priority")?,
            planned_at: row.try_get("planned_at")?,
            created_at: row.try_get("created_at")?,
            total_items: row.try_get("total_items")?,
            building: Building {
                id: row.try_get("building_id")?,
                code: row.try_get("building_code")?,
                name: row.try_get("building_name")?
            },
            cabinet: row.try_get("cabinet")?
        })
    }
}

#[derive(Serialize)]
struct TicketSchema {
    pub id: TicketId,
    pub title: String,
    pub description: String,
    pub author: String,
    pub author_contacts: String,
    pub status: TicketStatus,
    pub priority: TicketPriority,
    pub planned_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub building: Building,
    pub cabinet: Option<String>,
}

#[derive(thiserror::Error)]
pub enum GetTicketsError {
    #[error("Page number must be greater than 0")]
    InvalidPage,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetTicketsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetTicketsError {
    fn status_code(&self) -> StatusCode {
        match self {
            GetTicketsError::InvalidPage => StatusCode::BAD_REQUEST,
            GetTicketsError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn get_tickets(
    schema: QsQuery<GetTicketsSchema>,
    pool: web::Data<PgPool>,
    user_id: UserIdExtractor,
    user_role: UserRoleExtractor,
) -> Result<HttpResponse, GetTicketsError> {
    let schema = schema.into_inner();
    
    let page_size = schema.page_size
        .map(|size| size.clamp(10, 50))
        .unwrap_or(10);

    let page = schema.page.unwrap_or(1) - 1;

    if page < 0 {
        return Err(GetTicketsError::InvalidPage)
    }

    let client_id = if user_role.0 == UserRole::Client {
        Some(user_id.0)
    } else {
        None
    };

    let mut builder = get_builder(&schema, page, page_size, &client_id);

    let query = builder.build_query_as::<TicketWithMeta>();

    let tickets = query.fetch_all(pool.as_ref()).await
        .context("Failed to fetch tickets from database.")?;

    let total_items = match tickets.first() {
        Some(ticket) => ticket.total_items as u64,
        None => 0,
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
        created_at: ticket.created_at,
        building: ticket.building,
        cabinet: ticket.cabinet
    }).collect::<Vec<_>>();

    let res = PaginationResult::new_with_pagination(
        total_items,
        page_size,
        tickets
    );

    Ok(HttpResponse::Ok().json(res))
}

#[inline]
fn get_builder<'a>(
    schema: &'a GetTicketsSchema,
    page: TicketId,
    page_size: i8,
    client_id: &'a Option<UserId>,
) -> QueryBuilder<'a, sqlx::Postgres> {
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        r#"SELECT 
            t.id,
            title,
            description,
            author,
            author_contacts,
            t.status,
            priority,
            planned_at,
            t.created_at,
            b.id as "building_id",
            b.code as "building_code",
            b.name as "building_name",
            cabinet,
            COUNT(*) OVER() as total_items
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id 
        LEFT JOIN users u ON u.id = tu.assigned_to
        JOIN buildings b ON b.id = t.building_id
        JOIN departments d ON d.id = t.department_id
        "#
    );

    let mut has_filters = false;

    build_where_condition!(builder, has_filters, schema.statuses, "t.status", in);
    build_where_condition!(builder, has_filters, schema.priorities, "priority", in);
    build_where_condition!(builder, has_filters, schema.planned_from, "planned_at", ">=");
    build_where_condition!(builder, has_filters, schema.planned_to, "planned_at", "<=");
    build_where_condition!(builder, has_filters, schema.buildings, "building_id", in);
    build_where_condition!(builder, has_filters, schema.assigned_to, "tu.assigned_to", "=");
    build_where_condition!(builder, has_filters, schema.departments, "department_id", in);
    build_where_condition!(builder, has_filters, client_id, "author_id", "=");

    if let Some(s) = &schema.search {
        build_where_condition!(@add_where_and builder, has_filters);
        let s = format!("%{}%", s);

        builder.push("(title ILIKE ").push_bind(s.clone())
            .push(" OR description ILIKE ").push_bind(s)
            .push(")");
    }

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
        .push(schema.sort_order.clone().unwrap_or_default().as_str())
        .push(" LIMIT ")
        .push_bind(page_size as i64)
        .push(" OFFSET ")
        .push_bind(page_size as i64 * page);

    builder
}