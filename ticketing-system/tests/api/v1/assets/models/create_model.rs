use crate::helpers::{TestApp, spawn_app};

async fn create_model(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!(
            "{}/v1/assets/models",
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
async fn create_model_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test name",
        "category": 3
    });

    let resp = create_model(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_model_with_wrong_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(129),
        "category": 3
    });

    let resp = create_model(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_model_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = create_model(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_model_with_wrong_category_returns_409() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(10),
        "category": 999
    });

    let resp = create_model(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 409);
}

#[tokio::test]
async fn create_model_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(10),
        "category": 2
    });

    sqlx::query!(
        "DROP TABLE asset_models CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = create_model(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}