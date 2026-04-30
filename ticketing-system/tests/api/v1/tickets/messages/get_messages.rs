use crate::helpers::{TestApp, spawn_app};

async fn create_ticket_id(app: &TestApp) -> i64 {
    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    ticket_json["id"].as_i64().unwrap()
}

async fn get_messages(
    app: &TestApp,
    ticket_id: i64,
    token: Option<&str>,
) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .get(format!("{}/v1/tickets/{}/messages", app.address, ticket_id));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder.send().await.unwrap()
}

#[tokio::test]
async fn get_messages_hides_internal_for_client() {
    let app = spawn_app().await;

    let ticket_resp = app.create_test_ticket().await;
    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    sqlx::query!(
        "INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
        VALUES
            ($1, 1, 'public message', false),
            ($1, 1, 'internal message', true)
        ",
        ticket_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let client_login = app
        .create_user(ticketing_system::auth::types::UserRole::Client)
        .await;
    let (client_access, _) = app.get_jwt_tokens(&client_login, "admin").await;

    let resp = get_messages(&app, ticket_id, Some(&client_access)).await;

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    let items = json.as_array().unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["text"], "public message");
    assert_eq!(items[0]["is_internal"], false);
}

#[tokio::test]
async fn get_messages_shows_internal_for_employee() {
    let app = spawn_app().await;

    let ticket_id = create_ticket_id(&app).await;

    sqlx::query!(
        "INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
        VALUES
            ($1, 1, 'public message', false),
            ($1, 1, 'internal message', true)
        ",
        ticket_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let employee_login = app
        .create_user(ticketing_system::auth::types::UserRole::Employee)
        .await;
    let (employee_access, _) = app.get_jwt_tokens(&employee_login, "admin").await;

    let resp = get_messages(&app, ticket_id, Some(&employee_access)).await;

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    let items = json.as_array().unwrap();

    assert_eq!(items.len(), 2);
    assert!(items.iter().any(|item| item["text"] == "public message"));
    assert!(items.iter().any(|item| item["text"] == "internal message"));
}

#[tokio::test]
async fn get_messages_works_with_before_and_limit() {
    let app = spawn_app().await;

    let ticket_id = create_ticket_id(&app).await;

    let first = sqlx::query!(
        "INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
        VALUES ($1, 1, 'older message', false)
        RETURNING id",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let second = sqlx::query!(
        "INSERT INTO ticket_messages(ticket_id, user_id, message_text, is_internal)
        VALUES ($1, 1, 'newer message', false)
        RETURNING id",
        ticket_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!(
            "{}/v1/tickets/{}/messages?before={}&limit=20",
            app.address,
            ticket_id,
            second.id
        ))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    let items = json.as_array().unwrap();

    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["id"], first.id);
    assert_eq!(items[0]["text"], "older message");
}
