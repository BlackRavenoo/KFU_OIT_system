use ticketing_system::schema::assets::CategoryId;

use crate::helpers::{TestApp, spawn_app};

async fn update_category(app: &TestApp, body: &serde_json::Value, id: CategoryId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!(
            "{}/v1/assets/categories/{}",
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
async fn update_category_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_category().await;

    let body = serde_json::json!({
        "name": "Test",
    });

    let resp = update_category(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_category_with_invalid_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_category().await;

    let body = serde_json::json!({
        "name": "T".repeat(33),
    });

    let resp = update_category(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_category_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_category().await;

    let body = serde_json::json!({
        "name": "Test",
    });

    sqlx::query!("DROP TABLE asset_categories CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = update_category(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}