use crate::{helpers::spawn_app, v1::notifications::get_notifications::create_test_notifications};

#[tokio::test]
async fn get_notifications_count_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications/count", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_notifications_count_returns_count() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications/count", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json()
        .await
        .unwrap();

    assert_eq!(json.get("count").unwrap().as_i64(), Some(1));
}

#[tokio::test]
async fn get_notifications_count_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/notifications/count", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}