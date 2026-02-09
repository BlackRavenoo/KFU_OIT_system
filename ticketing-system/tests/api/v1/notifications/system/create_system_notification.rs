use chrono::{Duration, Utc};

use crate::helpers::{TestApp, spawn_app};

async fn create_system_notification(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/system_notifications", app.address))
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
async fn create_system_notification_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": Utc::now() + Duration::days(3)
    });

    let resp = create_system_notification(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_system_notification_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": Utc::now() + Duration::days(3)
    });

    sqlx::query!("DROP TABLE system_notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = create_system_notification(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}