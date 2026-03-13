use crate::helpers::{TestApp, spawn_app};

async fn create_status(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!(
            "{}/v1/assets/statuses",
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
async fn create_status_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test",
        "color": "#333333"
    });

    let resp = create_status(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_status_with_bad_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(33),
        "color": "#333333"
    });

    let resp = create_status(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_status_with_bad_color_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(32),
        "color": "989898"
    });

    let resp = create_status(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_status_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test",
        "color": "#333333"
    });

    sqlx::query!("DROP TABLE asset_statuses CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = create_status(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}