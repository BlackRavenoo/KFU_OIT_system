use ticketing_system::schema::tickets::TicketId;

use crate::helpers::{spawn_app, TestApp};

async fn assign_ticket(app: &TestApp, id: TicketId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .patch(format!("{}/v1/tickets/{}/assign", app.address, id));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
} 

#[tokio::test]
async fn assign_ticket_returns_200() {
    let app = spawn_app().await;

    app.create_test_ticket().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = assign_ticket(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn assign_ticket_without_token_returns_401() {
    let app = spawn_app().await;

    app.create_test_ticket().await;

    let resp = assign_ticket(&app, 1, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn assign_ticket_for_non_existent_ticket_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = assign_ticket(&app, 10, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn assign_ticket_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE tickets CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = assign_ticket(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}