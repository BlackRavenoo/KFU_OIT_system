use crate::helpers::spawn_app;
use ticketing_system::schema::notification::Notification;

#[tokio::test]
async fn notify_inserts_and_updates_notifications() {
    let app = spawn_app().await;

    let resp = app.create_test_ticket().await;
    let json: serde_json::Value = resp.json().await.unwrap();
    let ticket_id = json["id"].as_i64().unwrap();

    let email1 = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;
    let email2 = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let user1: i32 = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email1)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    let user2: i32 = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email2)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    let svc = ticketing_system::services::notification::NotificationService {};

    svc.notify(
        &app.db_pool,
        ticket_id,
        &[user1, user2],
        Notification::NewMessages { count: 1 },
    )
    .await
    .unwrap();

    let count: Option<i64> = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM notifications WHERE ticket_id = $1",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(count, Some(2));

    svc.notify(
        &app.db_pool,
        ticket_id,
        &[user1, user2],
        Notification::NewMessages { count: 2 },
    )
    .await
    .unwrap();

    let payload_count: Option<i32> = sqlx::query_scalar!(
        "SELECT (payload->'data'->>'count')::int FROM notifications WHERE ticket_id = $1 AND user_id = $2",
        ticket_id,
        user1
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(payload_count, Some(3));
}
