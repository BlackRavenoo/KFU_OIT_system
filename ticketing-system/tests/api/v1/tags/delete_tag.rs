use ticketing_system::schema::page::TagId;

use crate::helpers::{TestApp, spawn_app};

async fn delete_tag(app: &TestApp, id: TagId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!("{}/v1/tags/{}", app.address, id));
    
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn delete_tag_returns_200() {
    let app = spawn_app().await;

    app.create_test_tag().await;
    
    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;
    
    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = delete_tag(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_tag_for_nonexistent_tag_returns_200() {
    let app = spawn_app().await;
    
    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;
    
    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = delete_tag(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_tag_without_permissions_returns_403() {
    let app = spawn_app().await;
    
    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;
    
    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = delete_tag(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn delete_tag_without_token_returns_401() {
    let app = spawn_app().await;

    let resp = delete_tag(&app, 1, None).await;

    assert_eq!(resp.status(), 401);
}