use crate::helpers::{TestApp, spawn_app};

async fn create_message(
    app: &TestApp,
    ticket_id: i64,
    body: &serde_json::Value,
    token: Option<&str>,
) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/tickets/{}/messages", app.address, ticket_id))
        .json(body);

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder.send().await.unwrap()
}

#[tokio::test]
async fn create_message_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    let body = serde_json::json!({
        "message": "hello from test",
        "is_internal": true
    });

    let resp = create_message(&app, ticket_id, &body, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_message_forces_not_internal_for_client() {
    let app = spawn_app().await;

    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    let login = app
        .create_user(ticketing_system::auth::types::UserRole::Client)
        .await;
    let (access, _) = app.get_jwt_tokens(&login, "admin").await;

    let body = serde_json::json!({
        "message": "client message",
        "is_internal": true
    });

    let resp = create_message(&app, ticket_id, &body, Some(&access)).await;

    assert_eq!(resp.status(), 201);

    let row = sqlx::query!(
        "SELECT is_internal
        FROM ticket_messages
        WHERE ticket_id = $1
        ORDER BY id DESC
        LIMIT 1",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert!(!row.is_internal);
}
