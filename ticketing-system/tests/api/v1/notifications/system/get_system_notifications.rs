use crate::helpers::spawn_app;

#[tokio::test]
async fn get_system_notifications_returns_200() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = app.get_system_notifications(&body, Some(&access))
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

    let resp = app.get_system_notifications(&body, Some(&access))
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

    let resp = app.get_system_notifications(&body, Some(&access))
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

    let resp = app.get_system_notifications(&body, None)
        .await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let arr = json.as_array().unwrap();

    assert_eq!(arr.len(), 5);
}

#[tokio::test]
async fn get_system_notifications_with_db_err_returns_500() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    sqlx::query!("DROP TABLE system_notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.get_system_notifications(&body, Some(&access))
        .await;

    assert_eq!(resp.status(), 500);
}