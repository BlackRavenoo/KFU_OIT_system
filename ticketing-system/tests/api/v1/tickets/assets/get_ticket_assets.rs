use crate::helpers::{spawn_app, TestApp};

async fn get_ticket_assets(
	app: &TestApp,
	ticket_id: i64,
	token: Option<&str>
) -> reqwest::Response {
	let mut builder = reqwest::Client::new()
		.get(format!("{}/v1/tickets/{}/assets", app.address, ticket_id));

	if let Some(token) = token {
		builder = builder.bearer_auth(token);
	}

	builder
		.send()
		.await
		.unwrap()
}

#[tokio::test]
async fn get_ticket_assets_returns_200() {
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
			"comment": "Test comment"
		}),
		Some(&access)
	)
	.await
	.error_for_status()
	.unwrap();

	let resp = get_ticket_assets(&app, 1, Some(&access)).await;

	assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_ticket_assets_returns_full_asset_data_with_comment() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let model_id = app.create_test_model().await;
	let first_asset_id = app.create_test_asset(model_id).await;
	let second_asset_id = app.create_test_asset(model_id).await;
	let (access, _) = app.get_admin_jwt_tokens().await;

	app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": first_asset_id,
			"comment": "first"
		}),
		Some(&access)
	)
	.await
	.error_for_status()
	.unwrap();

	app.attach_asset(
		1,
		&serde_json::json!({
			"asset_id": second_asset_id
		}),
		Some(&access)
	)
	.await
	.error_for_status()
	.unwrap();

	let resp = get_ticket_assets(&app, 1, Some(&access)).await;
	assert_eq!(resp.status(), 200);

	let json: serde_json::Value = resp.json().await.unwrap();
	let items = json.as_array().unwrap();

	assert_eq!(items.len(), 2);
	assert!(items.iter().all(|item| item.get("id").is_some()));
	assert!(items.iter().all(|item| item.get("comment").is_some()));
	assert!(items.iter().all(|item| item.get("name").is_some()));
	assert!(items.iter().all(|item| item.get("status").is_some()));
	assert!(items.iter().all(|item| item.get("model").is_some()));

	assert_eq!(items[0]["id"], second_asset_id);
	assert_eq!(items[0]["comment"], serde_json::Value::Null);
	assert_eq!(items[1]["id"], first_asset_id);
	assert_eq!(items[1]["comment"], "first");
}

#[tokio::test]
async fn get_ticket_assets_without_token_returns_401() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let resp = get_ticket_assets(&app, 1, None).await;

	assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn get_ticket_assets_with_db_error_returns_500() {
	let app = spawn_app().await;

	app.create_test_ticket().await
		.error_for_status()
		.unwrap();

	let (access, _) = app.get_admin_jwt_tokens().await;

	sqlx::query!("DROP TABLE ticket_assets")
		.execute(&app.db_pool)
		.await
		.unwrap();

	let resp = get_ticket_assets(&app, 1, Some(&access)).await;

	assert_eq!(resp.status(), 500);
}
