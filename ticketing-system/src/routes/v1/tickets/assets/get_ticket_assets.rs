use std::net::IpAddr;

use actix_web::{HttpResponse, ResponseError, web::{self, Path}};
use anyhow::Context;
use chrono::{DateTime, Utc};
use mac_address::MacAddress;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, prelude::FromRow, query_as, types::Json};

use crate::{schema::{assets::{AssetId, Model, Status}, tickets::TicketId}, utils::error_chain_fmt};

#[derive(Deserialize, Serialize, FromRow)]
struct Asset {
	pub id: AssetId,
	pub name: String,
	pub description: Option<String>,
	pub serial_number: Option<String>,
	pub inventory_number: Option<String>,
	pub status: Json<Status>,
	pub location: Option<String>,
	pub assigned_to: Option<String>,
	pub model: Json<Model>,
	pub ip: Option<IpAddr>,
	pub mac: Option<MacAddress>,
	pub photo_key: Option<String>,
	pub commission_date: Option<DateTime<Utc>>,
	pub decommission_date: Option<DateTime<Utc>>,
	pub comment: Option<String>,
}

#[derive(thiserror::Error)]
pub enum GetTicketAssetsError {
	#[error(transparent)]
	Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for GetTicketAssetsError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		error_chain_fmt(self, f)
	}
}

impl ResponseError for GetTicketAssetsError {}

pub async fn get_ticket_assets(
	ticket_id: Path<TicketId>,
	pool: web::Data<PgPool>,
) -> Result<HttpResponse, GetTicketAssetsError> {
	let assets = select_assets(
		&pool,
		ticket_id.into_inner()
	)
	.await
	.context("Failed to get ticket assets")?;

	Ok(HttpResponse::Ok().json(assets))
}

#[tracing::instrument(
	name = "Get ticket assets from database",
	skip(pool)
)]
async fn select_assets(
	pool: &PgPool,
	ticket_id: TicketId,
) -> Result<Vec<Asset>, sqlx::Error> {
	query_as!(
		Asset,
		r#"
		SELECT
			a.id,
			a.name,
			a.description,
			a.serial_number,
			a.inventory_number,
			json_build_object(
				'id', ast.id,
				'name', ast.name,
				'color', ast.color
			) AS "status!: Json<Status>",
			a.location,
			a.assigned_to,
			jsonb_build_object(
				'id', am.id,
				'name', am.name,
				'category', jsonb_build_object(
					'id', ac.id,
					'name', ac.name,
					'color', ac.color,
					'notes', ac.notes
				)
			) AS "model!: Json<Model>",
			a.ip AS "ip: IpAddr",
			a.mac,
			a.photo_key,
			a.commission_date,
			a.decommission_date,
			ta.comment
		FROM ticket_assets ta
		JOIN assets a ON a.id = ta.asset_id
		JOIN asset_statuses ast ON ast.id = a.status
		JOIN asset_models am ON am.id = a.model_id
		JOIN asset_categories ac ON ac.id = am.category
		WHERE ta.ticket_id = $1
		ORDER BY a.id DESC
		"#,
		ticket_id
	)
	.fetch_all(pool)
	.await
}
