use ticketing_system::schema::notification::SystemNotificationId;

use crate::{helpers::{TestApp, spawn_app}};

async fn delete_system_notifications(app: &TestApp, id: SystemNotificationId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!("{}/v1/system_notifications/{}", app.address, id));
    
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn delete_system_notifications_returns_200() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = delete_system_notifications(&app, 1, Some(&access))
        .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_system_notifications_without_token_returns_401() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let resp = delete_system_notifications(&app, 1, None)
        .await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn delete_system_notifications_with_db_err_returns_500() {
    let app = spawn_app().await;

    app.create_test_system_notification().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE system_notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = delete_system_notifications(&app, 1, Some(&access))
        .await;

    assert_eq!(resp.status(), 500);
}