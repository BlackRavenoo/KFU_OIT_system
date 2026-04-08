use crate::helpers::spawn_app;

#[tokio::test]
async fn attach_asset_returns_200() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	let resp = app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": "Test comment"
		}),
		Some(&access)
	).await;

	assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn attach_asset_saves_link_in_db() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;
	let comment = "Asset is related to this ticket";

	app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": comment
		}),
		Some(&access)
	).await
	.error_for_status()
	.unwrap();

	let record = sqlx::query!(
		r#"
		SELECT ticket_id, asset_id, comment
		FROM ticket_assets
		WHERE ticket_id = $1 AND asset_id = $2
		"#,
		1_i64,
		asset_id
	)
	.fetch_one(&app.db_pool)
	.await
	.unwrap();

	assert_eq!(record.ticket_id, 1);
	assert_eq!(record.asset_id, asset_id);
	assert_eq!(record.comment.as_deref(), Some(comment));
}

#[tokio::test]
async fn attach_asset_without_token_returns_401() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let resp = app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": "Test comment"
		}),
		None
	).await;

	assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn attach_asset_with_empty_body_returns_400() {
	let app = spawn_app().await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	let resp = app.attach_asset(
		1,
		&serde_json::json!({}),
		Some(&access)
	).await;

	assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn attach_asset_with_invalid_asset_id_returns_400() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let (access, _) = app.get_admin_jwt_tokens().await;

	let resp = app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": 0
		}),
		Some(&access)
	).await;

	assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn attach_asset_with_empty_comment_returns_400() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let asset_id = app.create_test_asset(model_id).await;

	let (access, _) = app.get_admin_jwt_tokens().await;

	let resp = app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id,
			"comment": ""
		}),
		Some(&access)
	).await;

	assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn attach_asset_with_db_error_returns_500() {
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

	let resp = app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": asset_id
		}),
		Some(&access)
	).await;

	assert_eq!(resp.status(), 500);
}
