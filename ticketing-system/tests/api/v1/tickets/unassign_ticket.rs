use crate::helpers::spawn_app;
use ticketing_system::auth::types::UserRole;

#[tokio::test]
async fn unassign_from_self_removes_assignment_and_updates_status() {
    let app = spawn_app().await;

    let email = app.create_user(UserRole::Employee).await;
    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = app.create_test_ticket().await;
    let json: serde_json::Value = resp.json().await.unwrap();
    let ticket_id = json["id"].as_i64().unwrap();

    let client = reqwest::Client::new();
    let assign_resp = client
        .patch(format!("{}/v1/tickets/{}/assign", app.address, ticket_id))
        .bearer_auth(&access)
        .send()
        .await
        .unwrap();

    assert_eq!(assign_resp.status(), 200);

    
    let unassign_resp = client
        .patch(format!("{}/v1/tickets/{}/unassign", app.address, ticket_id))
        .bearer_auth(&access)
        .send()
        .await
        .unwrap();

    assert_eq!(unassign_resp.status(), 200);

    let count: Option<i64> = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM tickets_users WHERE ticket_id = $1",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(count, Some(0));

    let status: i16 = sqlx::query_scalar!("SELECT status FROM tickets WHERE id = $1", ticket_id)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    assert_eq!(status, ticketing_system::schema::tickets::TicketStatus::Open as i16);
}

#[tokio::test]
async fn unassign_ticket_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = app.create_test_ticket().await;
    let json: serde_json::Value = resp.json().await.unwrap();
    let ticket_id = json["id"].as_i64().unwrap();
    
        sqlx::query!(
            "DROP TABLE tickets CASCADE"
        )
        .execute(&app.db_pool)
        .await
        .unwrap();
    
    let resp = reqwest::Client::new()
        .patch(format!("{}/v1/tickets/{}/unassign", app.address, ticket_id))
        .bearer_auth(&access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}