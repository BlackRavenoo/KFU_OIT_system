use ticketing_system::schema::page::TagId;

use crate::helpers::{TestApp, spawn_app};

async fn update_tag(app: &TestApp, body: &serde_json::Value, tag_id: TagId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!("{}/v1/tags/{}", app.address, tag_id))
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
async fn update_tag_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    app.create_test_tag().await;

    let body = serde_json::json!({
        "name": "Test1"
    });

    let resp = update_tag(&app, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_tag_without_token_returns_401() {
    let app = spawn_app().await;

    app.create_test_tag().await;

    let body = serde_json::json!({
        "name": "Test1"
    });

    let resp = update_tag(&app, &body, 1, None).await;

    assert_eq!(resp.status(), 401);
}