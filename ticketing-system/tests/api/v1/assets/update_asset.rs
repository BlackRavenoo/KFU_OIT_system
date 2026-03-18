use ticketing_system::schema::assets::AssetId;

use crate::helpers::{TestApp, spawn_app};

async fn update_asset(app: &TestApp, body: &serde_json::Value, id: AssetId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!(
            "{}/v1/assets/{}",
            app.address,
            id
        ))
        .json(body);

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn update_asset_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
    });

    let resp = update_asset(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_asset_with_all_fields_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": model_id,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let resp = update_asset(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_asset_with_wrong_mac_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": model_id,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D",
    });

    let resp = update_asset(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_asset_with_wrong_model_id_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": 999,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D",
    });

    let resp = update_asset(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_asset_returns_with_db_err_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
    });

    sqlx::query!("DROP TABLE assets CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = update_asset(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}