use ticketing_system::schema::page::PageId;
use wiremock::{Mock, ResponseTemplate, matchers::{method, path_regex}};

use crate::helpers::{TestApp, spawn_app};

async fn delete_page(app: &TestApp, id: PageId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!("{}/v1/pages/{}", app.address, id));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn delete_page_returns_200() {
    let app = spawn_app().await;

    app.create_test_page().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    Mock::given(path_regex(r"/test-bucket/pages/.*\.json"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let resp = delete_page(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_page_for_nonexistent_page_returns_404() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    Mock::given(path_regex(r"/test-bucket/pages/.*\.json"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let resp = delete_page(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 404);
}

#[tokio::test]
async fn delete_page_without_token_returns_401() {
    let app = spawn_app().await;

    Mock::given(path_regex(r"/test-bucket/pages/.*\.json"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let resp = delete_page(&app, 1, None).await;

    assert_eq!(resp.status(), 401);
}