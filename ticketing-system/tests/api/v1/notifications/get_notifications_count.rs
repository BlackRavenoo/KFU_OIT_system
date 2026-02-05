use crate::helpers::{TestApp, spawn_app};

async fn create_test_notifications(app: &TestApp) {
    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let body = serde_json::json!({
        "title": "Test",
        "description": "Test",
        "author": "Test",
        "author_contacts": "999",
        "building_id": 1,
        "department_id": 1,
    });

    app.create_ticket(&body, None, Some(&access))
        .await
        .error_for_status()
        .unwrap();

    let notification_body = serde_json::json!({
        "type": "new_messages",
        "data": {
            "count": 1
        }
    });
    
    sqlx::query!(
        "INSERT INTO notifications(ticket_id, user_id, payload)
        VALUES (1, 1, $1)",
        &notification_body
    )
    .execute(&app.db_pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn get_notifications_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_notifications_returns_notifications() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json()
        .await
        .unwrap();

    assert!(json.as_array().unwrap().get(0).is_some());
}

#[tokio::test]
async fn get_notifications_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}