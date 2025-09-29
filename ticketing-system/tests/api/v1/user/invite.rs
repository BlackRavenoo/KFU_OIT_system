use ticketing_system::auth::types::UserRole;
use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::spawn_app;

#[tokio::test]
async fn invite_sends_a_confirmation_email_with_a_link() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.email_server)
        .await;

    app.invite_user(
        &serde_json::json!({
            "email": "someone@admin.com"
        }),
        Some(&access)
    ).await;

    let email_request = &app.email_server.received_requests().await.unwrap()[0];

    let confirmation_links = app.get_invitation_links(&email_request);

    assert_eq!(confirmation_links.html, confirmation_links.plain_text);
}

#[tokio::test]
async fn invite_by_unauthorized_user_returns_401() {
    let app = spawn_app().await;

    let response = app.invite_user(
        &serde_json::json!({
            "email": "someone@admin.com"
        }),
        None
    ).await;

    assert_eq!(response.status(), 401);
}

#[tokio::test]
async fn invite_by_non_admin_user_returns_403() {
    let app = spawn_app().await;

    let email = app.create_user(UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let response = app.invite_user(
        &serde_json::json!({
            "email": "someone@admin.com"
        }),
        Some(&access)
    ).await;

    assert_eq!(response.status(), 403);
}

#[tokio::test]
async fn invite_with_invalid_email_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let response = app.invite_user(
        &serde_json::json!({
            "email": "invalid-email"
        }),
        Some(&access)
    ).await;

    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn invite_with_missing_email_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let response = app.invite_user(
            &serde_json::json!({}),
            Some(&access)
        ).await;

    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn invite_existing_user_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(UserRole::Employee).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let response = app.invite_user(
        &serde_json::json!({
            "email": email
        }),
        Some(&access)
    ).await;

    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn invite_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    sqlx::query!("
        DROP TABLE users CASCADE
    ")
    .execute(&app.db_pool)
    .await
    .unwrap();

    let response = app.invite_user(
        &serde_json::json!({
            "email": "someone@admin.com"
        }),
        Some(&access)
    ).await;

    assert_eq!(response.status(), 500);
}

#[tokio::test]
async fn invite_same_email_twice_returns_same_token() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(2)
        .mount(&app.email_server)
        .await;

    for _ in 0..2 {
        app.invite_user(
            &serde_json::json!({
                "email": "someone@admin.com"
            }),
            Some(&access)
        ).await;
    }

    let email_requests = &app.email_server.received_requests().await.unwrap();

    let links = email_requests.iter()
        .map(|email_request|app.get_invitation_links(email_request))
        .collect::<Vec<_>>();

    assert_eq!(links[0].html, links[1].html);
}