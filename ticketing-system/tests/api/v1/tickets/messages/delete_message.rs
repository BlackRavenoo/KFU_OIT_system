use crate::helpers::{TestApp, spawn_app};

async fn delete_message(
    app: &TestApp,
    ticket_id: i64,
    message_id: i64,
    token: Option<&str>,
) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!(
            "{}/v1/tickets/{}/messages/{}",
            app.address, ticket_id, message_id
        ));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder.send().await.unwrap()
}


#[tokio::test]
async fn delete_message_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    let message = sqlx::query!(
        "INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
        VALUES ($1, 1, 'to delete', false)
        RETURNING id",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let resp = delete_message(&app, ticket_id, message.id, Some(&access)).await;

    assert_eq!(resp.status(), 200);

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(
            SELECT 1
            FROM ticket_messages
            WHERE id = $1
        )",
        message.id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .unwrap_or(false);

    assert!(!exists);
}

#[tokio::test]
async fn delete_message_for_nonexistent_returns_404() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    let resp = delete_message(&app, ticket_id, 999_999, Some(&access)).await;

    assert_eq!(resp.status(), 404);
}
