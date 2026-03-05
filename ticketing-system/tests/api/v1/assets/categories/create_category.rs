use crate::helpers::{TestApp, spawn_app};

async fn create_category(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!(
            "{}/v1/assets/categories",
            app.address
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
async fn create_category_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test category",
        "color": "#FFFFFF",
        "notes": "Test"
    });

    let resp = create_category(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_category_with_invalid_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "T".repeat(33),
        "color": "#FFFFFF",
        "notes": "Test"
    });

    let resp = create_category(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_category_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test category",
        "color": "#FFFFFF",
        "notes": "Test"
    });

    sqlx::query!("DROP TABLE asset_categories CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = create_category(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}