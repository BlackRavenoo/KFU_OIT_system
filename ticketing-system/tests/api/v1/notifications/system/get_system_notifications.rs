use crate::helpers::{TestApp, spawn_app};

async fn get_system_notifications(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {        
    let mut builder = reqwest::Client::new()
        .get(format!(
            "{}/v1/system_notifications?{}",
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
async fn get_system_notifications_returns_200() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = get_system_notifications(&app, &body, Some(&access))
        .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_system_notifications_returns_only_active_notifications() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let active_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() + chrono::Duration::days(1)
    });

    let inactive_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() - chrono::Duration::days(1)
    });

    for _ in 0..5 {
        app.create_system_notification(&active_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();

        app.create_system_notification(&inactive_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();
    }

    let body = serde_json::json!({});

    let resp = get_system_notifications(&app, &body, Some(&access))
        .await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let arr = json.as_array().unwrap();

    assert_eq!(arr.len(), 5);
}

#[tokio::test]
async fn get_all_system_notifications_returns_all_notifications_for_admin() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let active_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() + chrono::Duration::days(1)
    });

    let inactive_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() - chrono::Duration::days(1)
    });

    for _ in 0..5 {
        app.create_system_notification(&active_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();

        app.create_system_notification(&inactive_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();
    }

    let body = serde_json::json!({
        "all": true
    });

    let resp = get_system_notifications(&app, &body, Some(&access))
        .await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let arr = json.as_array().unwrap();

    assert_eq!(arr.len(), 10);
}

#[tokio::test]
async fn get_all_system_notifications_returns_only_active_notifications_for_user() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let active_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() + chrono::Duration::days(1)
    });

    let inactive_notification_body = serde_json::json!({
        "text": "Тестовое уведомление",
        "category": 0,
        "active_until": chrono::Utc::now() - chrono::Duration::days(1)
    });

    for _ in 0..5 {
        app.create_system_notification(&active_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();

        app.create_system_notification(&inactive_notification_body, Some(&access)).await
            .error_for_status()
            .unwrap();
    }

    let body = serde_json::json!({
        "all": true
    });

    let resp = get_system_notifications(&app, &body, None)
        .await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let arr = json.as_array().unwrap();

    assert_eq!(arr.len(), 5);
}