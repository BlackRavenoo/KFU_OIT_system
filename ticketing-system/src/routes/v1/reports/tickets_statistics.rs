use std::collections::BTreeMap;

use actix_web::{http::{header::{ContentDisposition, DispositionParam, DispositionType}, StatusCode}, web, HttpResponse, ResponseError};
use anyhow::Context;
use chrono::{DateTime, Utc};
use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json, PgPool};

use crate::{
    schema::{
        tickets::TicketStatus,
    },
    utils::error_chain_fmt,
};

#[derive(Deserialize)]
pub struct GenerateTicketsStatisticsReportSchema {
    pub from_date: DateTime<Utc>,
    pub to_date: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
struct Assignee {
    pub name: String,
}

#[derive(sqlx::FromRow)]
struct TicketRow {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub cabinet: Option<String>,
    pub created_at: DateTime<Utc>,
    pub status: TicketStatus,
    pub building_name: String,
    pub assigned_to: Json<Vec<Assignee>>,
}

#[derive(thiserror::Error)]
pub enum GenerateTicketsStatisticsReportError {
    #[error("`from_date` must be less than or equal to `to_date`")]
    InvalidRange,
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for GenerateTicketsStatisticsReportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GenerateTicketsStatisticsReportError {
    fn status_code(&self) -> StatusCode {
        match self {
            GenerateTicketsStatisticsReportError::InvalidRange => StatusCode::BAD_REQUEST,
            GenerateTicketsStatisticsReportError::Unexpected(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub async fn generate_tickets_statistics_report(
    schema: web::Json<GenerateTicketsStatisticsReportSchema>,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse, GenerateTicketsStatisticsReportError> {
    let schema = schema.into_inner();

    if schema.from_date > schema.to_date {
        return Err(GenerateTicketsStatisticsReportError::InvalidRange);
    }

    let tickets = select_tickets(&pool, schema.from_date, schema.to_date)
        .await
        .context("Failed to load tickets for report")?;

    let xlsx = build_workbook_bytes(&tickets, schema.from_date, schema.to_date)
        .context("Failed to build XLSX report")?;

    let file_name = format!(
        "statistic_{}_{}.xlsx",
        schema.from_date.format("%Y-%m-%d"),
        schema.to_date.format("%Y-%m-%d")
    );

    Ok(HttpResponse::Ok()
        .content_type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .insert_header(ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(file_name)],
        })
        .body(xlsx))
}

#[tracing::instrument(name = "Get report tickets from database", skip(pool))]
async fn select_tickets(
    pool: &PgPool,
    from_ts: DateTime<Utc>,
    to_ts: DateTime<Utc>,
) -> Result<Vec<TicketRow>, sqlx::Error> {
    let mut offset = 0_i64;
    let mut tickets = Vec::new();

    const BATCH_SIZE: i64 = 1000;

    loop {
        let chunk = select_tickets_batch(pool, from_ts, to_ts, BATCH_SIZE, offset).await?;
        let fetched = chunk.len() as i64;

        tickets.extend(chunk);

        if fetched < BATCH_SIZE {
            break;
        }

        offset += BATCH_SIZE;
    }

    Ok(tickets)
}

#[tracing::instrument(name = "Get report tickets batch from database", skip(pool))]
async fn select_tickets_batch(
    pool: &PgPool,
    from_ts: DateTime<Utc>,
    to_ts: DateTime<Utc>,
    limit: i64,
    offset: i64,
) -> Result<Vec<TicketRow>, sqlx::Error> {
    sqlx::query_as!(
        TicketRow,
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.cabinet,
            t.created_at,
            t.status as "status!: TicketStatus",
            b.name as "building_name!",
            COALESCE(
                JSON_AGG(JSON_BUILD_OBJECT('name', u.name))
                    FILTER (WHERE u.id IS NOT NULL),
                '[]'::json
            ) as "assigned_to!: Json<Vec<Assignee>>"
        FROM tickets t
        LEFT JOIN tickets_users tu ON tu.ticket_id = t.id
        LEFT JOIN users u ON u.id = tu.assigned_to
        JOIN buildings b ON b.id = t.building_id
        WHERE t.created_at >= $1
          AND t.created_at <= $2
        GROUP BY t.id, b.id
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $3 OFFSET $4
        "#,
        from_ts,
        to_ts,
        limit,
        offset,
    )
    .fetch_all(pool)
    .await
}

fn build_workbook_bytes(
    tickets: &[TicketRow],
    from_date: DateTime<Utc>,
    to_date: DateTime<Utc>,
) -> Result<Vec<u8>, rust_xlsxwriter::XlsxError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name("Отчёт")?;

    worksheet.set_column_width(0, 10.0)?;
    worksheet.set_column_width(1, 30.0)?;
    worksheet.set_column_width(2, 55.0)?;
    worksheet.set_column_width(3, 24.0)?;
    worksheet.set_column_width(4, 24.0)?;
    worksheet.set_column_width(5, 28.0)?;
    worksheet.set_column_width(6, 14.0)?;

    let base_format = Format::new()
        .set_border(FormatBorder::Thin)
        .set_text_wrap()
        .set_align(FormatAlign::Top);

    let header_format = Format::new()
        .set_bold()
        .set_font_name("Times New Roman")
        .set_background_color(Color::RGB(0xE3F2FD))
        .set_border(FormatBorder::Thin)
        .set_text_wrap()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter);

    let cancelled_format = base_format.clone().set_background_color(Color::RGB(0xFFC7CE));

    let centered_id_format = base_format.clone().set_align(FormatAlign::Center);

    let section_header_format = header_format.clone();

    let headers = [
        "ID",
        "Заголовок",
        "Описание",
        "Кабинет",
        "Дата создания",
        "Исполнители",
        "Статус",
    ];

    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format)?;
    }

    let mut status_counts: BTreeMap<&'static str, u32> = BTreeMap::from([
        ("Открыт", 0),
        ("В работе", 0),
        ("Выполнено", 0),
        ("Отменено", 0),
    ]);
    let mut performer_counts: BTreeMap<String, u32> = BTreeMap::new();

    for (idx, ticket) in tickets.iter().enumerate() {
        let row = (idx + 1) as u32;

        let status = status_to_ru(&ticket.status);
        if let Some(cnt) = status_counts.get_mut(status) {
            *cnt += 1;
        }

        let assignees = ticket
            .assigned_to
            .0
            .iter()
            .map(|u| u.name.as_str())
            .collect::<Vec<_>>()
            .join(", ");

        for a in &ticket.assigned_to.0 {
            *performer_counts.entry(a.name.clone()).or_insert(0) += 1;
        }

        let cabinet = format!(
            "{}, {}",
            ticket.building_name,
            ticket.cabinet.as_deref().unwrap_or_default()
        )
        .trim_matches(|c| c == ',' || c == ' ')
        .to_string();

        let row_format = if matches!(ticket.status, TicketStatus::Cancelled) {
            &cancelled_format
        } else {
            &base_format
        };

        worksheet.write_number_with_format(row, 0, ticket.id as f64, &centered_id_format)?;
        worksheet.write_string_with_format(row, 1, &ticket.title, row_format)?;
        worksheet.write_string_with_format(row, 2, &ticket.description, row_format)?;
        worksheet.write_string_with_format(row, 3, &cabinet, row_format)?;
        worksheet.write_string_with_format(
            row,
            4,
            ticket.created_at.format("%d.%m.%Y %H:%M").to_string(),
            row_format,
        )?;
        worksheet.write_string_with_format(row, 5, &assignees, row_format)?;
        worksheet.write_string_with_format(row, 6, status, row_format)?;
    }

    let stat_header_row = tickets.len() as u32 + 2;
    worksheet.merge_range(stat_header_row, 0, stat_header_row, 1, "Статистика по статусам", &section_header_format)?;
    worksheet.merge_range(stat_header_row, 3, stat_header_row, 4, "Статистика по исполнителям", &section_header_format)?;

    let mut stat_row = stat_header_row + 1;
    for status in ["Открыт", "В работе", "Выполнено", "Отменено"] {
        let count = *status_counts.get(status).unwrap_or(&0);
        worksheet.write_string_with_format(stat_row, 0, status, &base_format)?;
        worksheet.write_number_with_format(stat_row, 1, count as f64, &base_format)?;
        stat_row += 1;
    }

    let mut performer_row = stat_header_row + 1;
    for (name, count) in performer_counts {
        worksheet.write_string_with_format(performer_row, 3, &name, &base_format)?;
        worksheet.write_number_with_format(performer_row, 4, count as f64, &base_format)?;
        performer_row += 1;
    }

    let params_header_row = stat_row + 1;
    worksheet.merge_range(params_header_row, 0, params_header_row, 1, "Параметры отчёта", &section_header_format)?;

    let period = format!(
        "{} — {}",
        from_date.format("%d.%m.%Y"),
        to_date.format("%d.%m.%Y")
    );

    let params = [
        ("Период", period),
        (
            "Дата формирования",
            Utc::now().format("%d.%m.%Y %H:%M").to_string(),
        ),
    ];

    for (i, (name, value)) in params.iter().enumerate() {
        let row = params_header_row + i as u32 + 1;
        worksheet.write_string_with_format(row, 0, *name, &base_format)?;
        worksheet.write_string_with_format(row, 1, value, &base_format)?;
    }
    
    workbook.save_to_buffer()
}

fn status_to_ru(status: &TicketStatus) -> &'static str {
    match status {
        TicketStatus::Open => "Открыт",
        TicketStatus::InProgress => "В работе",
        TicketStatus::Closed => "Выполнено",
        TicketStatus::Cancelled => "Отменено",
    }
}
