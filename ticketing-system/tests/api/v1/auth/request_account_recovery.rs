use wiremock::{Mock, ResponseTemplate, matchers::{method, path}};

use crate::helpers::{spawn_app};

fn extract_token(email_request: &wiremock::Request, expected_path: &str) -> String {
    let body: serde_json::Value = serde_json::from_slice(&email_request.body).unwrap();

    let get_token_from_text = |text: &str| {
        linkify::LinkFinder::new()
            .links(text)
            .filter(|link| *link.kind() == linkify::LinkKind::Url)
            .filter_map(|link| reqwest::Url::parse(link.as_str()).ok())
            .find(|url| url.path() == expected_path)
            .and_then(|url| {
                url.query_pairs()
                    .find(|(k, _)| k == "token")
                    .map(|(_, v)| v.into_owned())
            })
    };

    get_token_from_text(body["html"].as_str().unwrap())
        .or_else(|| get_token_from_text(body["text"].as_str().unwrap()))
        .expect("Failed to extract token from email")
}

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
    let token = extract_token(email_request, "/reset-password");
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
