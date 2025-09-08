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

    reqwest::Client::new()
        .post(format!("{}/v1/user/admin/invite", app.address))
        .json(&serde_json::json!({
            "email": "someone@admin.com"
        }))
        .bearer_auth(access)
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let email_request = &app.email_server.received_requests().await.unwrap()[0];

    let confirmation_links = app.get_confirmation_links(&email_request);

    assert_eq!(confirmation_links.html, confirmation_links.plain_text);
}