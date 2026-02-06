use crate::{helpers::{TestApp, spawn_app}, v1::notifications::get_notifications::create_test_notifications};

async fn read_notifications(app: &TestApp, json: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/notifications/read", app.address))
        .json(json);
        
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn read_notifications_returns_200() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let json = serde_json::json!({
        "notification_ids": vec![1]
    });

    let resp = read_notifications(&app, &json, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn read_notifications_changes_notification_status() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let json = serde_json::json!({
        "notification_ids": vec![1]
    });

    read_notifications(&app, &json, Some(&access)).await
        .error_for_status()
        .unwrap();

    let is_read = sqlx::query!(
        "SELECT read FROM notifications
        WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .read;

    assert_eq!(is_read, true);
}