use crate::{helpers::{spawn_app, TestApp}, v1::notifications::get_notifications::create_test_notifications};

async fn delete_notifications(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!("{}/v1/notifications", app.address))
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
async fn delete_notifications_returns_200_and_removes_rows() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "notification_ids": vec![1]
    });

    let resp = delete_notifications(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);

    let count: Option<i64> = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM notifications WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(count, Some(0));
}

#[tokio::test]
async fn delete_notifications_with_db_error_returns_500() {
    let app = spawn_app().await;

    create_test_notifications(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE notifications CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let body = serde_json::json!({
        "notification_ids": vec![1]
    });

    let resp = delete_notifications(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}
