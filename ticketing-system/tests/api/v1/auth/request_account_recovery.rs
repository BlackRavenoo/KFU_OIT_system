use wiremock::{Mock, ResponseTemplate, matchers::{method, path}};

use crate::helpers::{spawn_app};

#[tokio::test]
async fn request_account_recovery_sends_email_for_existing_user() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let mock_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let email_request = &mock_guard.received_requests().await[0];
    let links = app.get_invitation_links(email_request);
    let token = links.html.query_pairs().find(|(k, _)| k == &std::borrow::Cow::Borrowed("token")).unwrap().1;
    assert!(!token.is_empty());
}

#[tokio::test]
async fn request_account_recovery_no_user_does_not_send_email() {
    let app = spawn_app().await;

    Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.email_server)
        .await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": "noone@example.com" }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn request_account_recovery_email_client_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&app.email_server)
        .await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}
