use crate::helpers::{create_invitation, spawn_app};

#[tokio::test]
async fn validate_token_returns_200() {
    let app = spawn_app().await;

    let (_, token) = create_invitation(&app).await;

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

    let (email, token) = create_invitation(&app).await;

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