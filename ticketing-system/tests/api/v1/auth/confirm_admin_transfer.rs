use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::spawn_app;
use ticketing_system::auth::types::UserRole;

fn extract_token(email_request: &wiremock::Request) -> String {
    let body: serde_json::Value = serde_json::from_slice(&email_request.body).unwrap();

    let get_token_from_text = |text: &str| {
        linkify::LinkFinder::new()
            .links(text)
            .filter(|link| *link.kind() == linkify::LinkKind::Url)
            .filter_map(|link| reqwest::Url::parse(link.as_str()).ok())
            .find(|url| url.path() == "/confirm-admin-transfer")
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
async fn confirm_admin_transfer_swaps_roles() {
    let app = spawn_app().await;

    let target_email = app.create_user(UserRole::Employee).await;
    let target_id: i32 = sqlx::query_scalar!(
        "SELECT id FROM users WHERE email = $1",
        target_email
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let admin_id: i32 = sqlx::query_scalar!(
        "SELECT id FROM users WHERE email = 'admin@example.com'"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let email_guard = Mock::given(path("/v1/email"))
        .and(method("POST"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount_as_scoped(&app.email_server)
        .await;

    let request_resp = reqwest::Client::new()
        .post(format!("{}/v1/user/admin/transfer", app.address))
        .bearer_auth(access)
        .json(&serde_json::json!({ "user_id": target_id }))
        .send()
        .await
        .unwrap();

    assert_eq!(request_resp.status(), 200);

    let token = extract_token(&email_guard.received_requests().await[0]);

    let confirm_resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/admin_transfer/confirm", app.address))
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
        .unwrap();

    assert_eq!(confirm_resp.status(), 200);

    let admin_role: i16 = sqlx::query_scalar!(
        "SELECT role FROM users WHERE id = $1",
        admin_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    let target_role: i16 = sqlx::query_scalar!(
        "SELECT role FROM users WHERE id = $1",
        target_id
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(admin_role, UserRole::Moderator as i16);
    assert_eq!(target_role, UserRole::Admin as i16);
}

#[tokio::test]
async fn confirm_admin_transfer_with_missing_token_returns_400() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/admin_transfer/confirm", app.address))
        .json(&serde_json::json!({ "token": "missing-token" }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}
