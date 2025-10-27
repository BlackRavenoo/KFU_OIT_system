use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

use crate::helpers::{spawn_app, TestApp};

async fn create_page(app: &TestApp, body: &serde_json::Value, token: Option<&str>, expect: u64) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/pages/", app.address))
        .json(body);
    
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    let _mock_guard = Mock::given(path_regex(r"/test-bucket/pages/.*\.json"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(expect)
        .mount_as_scoped(&app.s3_server)
        .await;

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn create_page_returns_201() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = create_page(&app, &body, Some(&access), 1).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_page_returns_id() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = create_page(&app, &body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json.get("id").unwrap().as_i64().unwrap(), 1);
}

#[tokio::test]
async fn create_page_returns_incremented_id() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = create_page(&app, &body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json.get("id").unwrap().as_i64().unwrap(), 1);

    let resp = create_page(&app, &body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json.get("id").unwrap().as_i64().unwrap(), 2);
}

#[tokio::test]
async fn create_page_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = create_page(&app, &body, None, 0).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn create_page_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = create_page(&app, &serde_json::json!({}), Some(&access), 0).await;

    assert_eq!(resp.status(), 400);
}