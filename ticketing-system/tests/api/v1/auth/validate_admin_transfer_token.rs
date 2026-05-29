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
        .post(format!("{}/v1/auth/admin_transfer/validate", app.address))
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn validate_admin_transfer_token_roundtrip() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let row = sqlx::query!("SELECT id FROM users WHERE email = $1", email)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    let target_id: i32 = row.id;

    let mock_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/user/admin/transfer", app.address))
        .bearer_auth(&access)
        .json(&serde_json::json!({ "user_id": target_id }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let email_request = &mock_guard.received_requests().await[0];
    let token = extract_token(email_request, "/confirm-admin-transfer");

    let resp = post_validate(&app, &token).await;
    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json["from_user_id"].as_i64().unwrap(), 1);
    assert_eq!(json["to_user_id"].as_i64().unwrap(), target_id as i64);
}

#[tokio::test]
async fn validate_admin_transfer_token_nonexistent_returns_400() {
    let app = spawn_app().await;

    let resp = post_validate(&app, "not-a-token").await;
    assert_eq!(resp.status(), 400);
}
