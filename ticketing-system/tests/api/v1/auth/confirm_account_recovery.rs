use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::spawn_app;

fn extract_token(email_request: &wiremock::Request) -> String {
    let body: serde_json::Value = serde_json::from_slice(&email_request.body).unwrap();

    let get_token_from_text = |text: &str| {
        linkify::LinkFinder::new()
            .links(text)
            .filter(|link| *link.kind() == linkify::LinkKind::Url)
            .filter_map(|link| reqwest::Url::parse(link.as_str()).ok())
            .find(|url| url.path() == "/reset-password")
            .and_then(|url| {
                url.query_pairs()
                    .find(|(key, _)| key == "token")
                    .map(|(_, value)| value.into_owned())
            })
    };

    get_token_from_text(body["html"].as_str().unwrap())
        .or_else(|| get_token_from_text(body["text"].as_str().unwrap()))
        .expect("Failed to extract token from email")
}

#[tokio::test]
async fn confirm_account_recovery_changes_password() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let email_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    let request_resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .unwrap();

    assert_eq!(request_resp.status(), 200);

    let token = extract_token(&email_guard.received_requests().await[0]);

    let confirm_resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/confirm", app.address))
        .json(&serde_json::json!({
            "token": token,
            "new_password": "Newpassword1"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(confirm_resp.status(), 200);

    let login_resp = app.get_jwt_tokens(&email, "Newpassword1").await;

    assert!(!login_resp.0.is_empty());
}

#[tokio::test]
async fn confirm_account_recovery_with_missing_user_returns_404() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let email_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/request", app.address))
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let token = extract_token(&email_guard.received_requests().await[0]);

    sqlx::query!("DELETE FROM users WHERE email = $1", email)
        .execute(&app.db_pool)
        .await
        .unwrap();

    let confirm_resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/recovery/confirm", app.address))
        .json(&serde_json::json!({
            "token": token,
            "new_password": "Newpassword1"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(confirm_resp.status(), 404);
}
