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

async fn post_validate(app: &crate::helpers::TestApp, token: &str) -> reqwest::Response {
    reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/validate", app.address))
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn validate_recovery_token_returns_200_for_existing_token() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let mock_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    let _ = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .unwrap();

    let email_request = &mock_guard.received_requests().await[0];
    let token = extract_token(email_request, "/reset-password");

    let resp = post_validate(&app, &token).await;
    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn validate_recovery_token_returns_400_for_nonexistent_token() {
    let app = spawn_app().await;

    let resp = post_validate(&app, "not-a-token").await;
    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn validate_recovery_token_without_data_returns_400() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/validate", app.address))
        .json(&serde_json::json!({}))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}
