use chrono::{Duration, Utc};

use crate::helpers::spawn_app;

#[tokio::test]
async fn create_system_notification_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": Utc::now() + Duration::days(3)
    });

    let resp = app.create_system_notification(&body, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_system_notification_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": Utc::now() + Duration::days(3)
    });

    let resp = app.create_system_notification(&body, None).await;

    assert_eq!(resp.status(), 401);
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

    let resp = app.create_system_notification(&body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}