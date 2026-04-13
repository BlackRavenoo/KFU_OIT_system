use crate::helpers::spawn_app;

#[tokio::test]
async fn delete_ticket_asset_returns_200() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": "test"
		}),
		Some(&access)
	)
	.await
	.error_for_status()
	.unwrap();

	let resp = app.delete_ticket_asset(1, asset_id, Some(&access)).await;

	assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_ticket_asset_deletes_link_from_db() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": "test"
		}),
		Some(&access)
	)
	.await
	.error_for_status()
	.unwrap();

	app.delete_ticket_asset(1, asset_id, Some(&access)).await
		.error_for_status()
		.unwrap();

	let count = sqlx::query_scalar!(
		r#"
		SELECT COUNT(*) as "count!"
		FROM ticket_assets
		WHERE ticket_id = $1 AND asset_id = $2
		"#,
		1_i64,
		asset_id
	)
	.fetch_one(&app.db_pool)
	.await
	.unwrap();

	assert_eq!(count, 0);
}

#[tokio::test]
async fn delete_ticket_asset_without_token_returns_401() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let resp = app.delete_ticket_asset(1, asset_id, None).await;

	assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn delete_ticket_asset_with_db_error_returns_500() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	sqlx::query!("DROP TABLE ticket_assets")
		.execute(&app.db_pool)
		.await
		.unwrap();

	let resp = app.delete_ticket_asset(1, asset_id, Some(&access)).await;

	assert_eq!(resp.status(), 500);
}
