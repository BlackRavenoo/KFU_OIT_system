use actix_web::{HttpResponse, ResponseError, web::{self, Path}};
use anyhow::Context;
use sqlx::PgPool;

use crate::{schema::{assets::AssetId, tickets::TicketId}, utils::error_chain_fmt};

#[derive(thiserror::Error)]
pub enum DeleteTicketAssetError {
	#[error(transparent)]
	Unexpected(#[from] anyhow::Error),
}

impl std::fmt::Debug for DeleteTicketAssetError {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		error_chain_fmt(self, f)
	}
}

impl ResponseError for DeleteTicketAssetError {}

pub async fn delete_ticket_asset(
	path: Path<(TicketId, AssetId)>,
	pool: web::Data<PgPool>,
) -> Result<HttpResponse, DeleteTicketAssetError> {
	let (ticket_id, asset_id) = path.into_inner();

	delete(
		ticket_id,
		asset_id,
		&pool
	)
	.await
	.context("Failed to delete asset from ticket")?;

	Ok(HttpResponse::Ok().finish())
}

#[tracing::instrument(
	name = "Delete asset from ticket",
	skip(pool)
)]
async fn delete(
	ticket_id: TicketId,
	asset_id: AssetId,
	pool: &PgPool,
) -> Result<(), sqlx::Error> {
	sqlx::query!(
		r#"
		DELETE FROM ticket_assets
		WHERE ticket_id = $1 AND asset_id = $2
		"#,
		ticket_id,
		asset_id
	)
	.execute(pool)
	.await?;

	Ok(())
}
