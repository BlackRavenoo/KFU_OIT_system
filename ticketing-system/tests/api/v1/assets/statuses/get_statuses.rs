use crate::helpers::{TestApp, spawn_app};

async fn get_statuses(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .get(format!(
            "{}/v1/assets/statuses?{}",
            app.address,
            serde_qs::to_string(body).unwrap()
        ));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn get_statuses_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = get_statuses(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_statuses_with_filters_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "page": 2,
        "page_size": 50,
        "name": "fff",
        "sort_order": "desc"
    });

    let resp = get_statuses(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_statuses_with_wrong_page_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "page": -1
    });

    let resp = get_statuses(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_statuses_with_wrong_page_size_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "page_size": 5
    });

    let resp = get_statuses(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_statuses_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    sqlx::query!("DROP TABLE asset_statuses CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = get_statuses(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}