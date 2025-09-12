use std::borrow::Cow;

use fake::{faker::internet::en::SafeEmail, Fake};
use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::{spawn_app, TestApp};

// Returns email + token
async fn invite_user(app: &TestApp) -> (String, String) {
    let email = SafeEmail().fake::<String>();

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.email_server)
        .await;

    reqwest::Client::new()
        .post(format!("{}/v1/user/admin/invite", app.address))
        .json(&serde_json::json!({
            "email": email
        }))
        .bearer_auth(access)
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let email_request = &app.email_server.received_requests().await.unwrap()[0];

    let url = app.get_confirmation_links(email_request).html;

    let (_, token) = url.query_pairs()
        .find(|(key, _)| key == &Cow::Borrowed("token"))
        .unwrap();

    (email, token.to_string())
}

#[tokio::test]
async fn validate_token_returns_200() {
    let app = spawn_app().await;

    let (_, token) = invite_user(&app).await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/validate", app.address))
        .json(&serde_json::json!({
            "token": token
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn validate_token_returns_right_email() {
    let app = spawn_app().await;

    let (email, token) = invite_user(&app).await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/validate", app.address))
        .json(&serde_json::json!({
            "token": token
        }))
        .send()
        .await
        .unwrap();

    let json = resp.json::<serde_json::Value>()
        .await
        .unwrap();

    let email_from_resp = json["email"]
        .as_str()
        .unwrap();

    assert_eq!(email, email_from_resp);
}

#[tokio::test]
async fn validate_not_existent_token_returns_400() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/validate", app.address))
        .json(&serde_json::json!({
            "token": "abc"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn validate_without_data_returns_400() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/validate", app.address))
        .json(&serde_json::json!({}))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}