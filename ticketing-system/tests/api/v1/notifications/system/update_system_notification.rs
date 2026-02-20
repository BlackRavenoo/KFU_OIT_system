use ticketing_system::schema::notification::SystemNotificationId;

use crate::helpers::{TestApp, spawn_app};

async fn update_system_notifications(app: &TestApp, id: SystemNotificationId, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {        
    let mut builder = reqwest::Client::new()
        .put(format!(
            "{}/v1/system_notifications/{}",
            app.address,
            id
        ))
        .json(&body);
    
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn update_system_notifications_returns_200() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "text": "Новый текст"
    });

    let resp = update_system_notifications(&app, 1, &body, Some(&access))
        .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_system_notifications_with_db_err_returns_500() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "text": "Новый текст"
    });

    sqlx::query!("DROP TABLE system_notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = update_system_notifications(&app, 1, &body, Some(&access))
        .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_system_notifications_updates_notification() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let notification = app.get_system_notifications(
        &serde_json::json!({}),
        Some(&access)
    ).await;

    let json: serde_json::Value = notification.json().await.unwrap();

    let old_text = json.as_array()
        .unwrap()[0]
        .get("text")
        .unwrap()
        .as_str()
        .unwrap();

    let body = serde_json::json!({
        "text": "Новый текст"
    });

    update_system_notifications(&app, 1, &body, Some(&access))
        .await;

    let resp = app.get_system_notifications(
        &serde_json::json!({}),
        Some(&access)
    ).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let text = json.as_array()
        .unwrap()[0]
        .get("text")
        .unwrap()
        .as_str()
        .unwrap();

    assert_eq!(text, "Новый текст");
    assert_ne!(old_text, text);
}