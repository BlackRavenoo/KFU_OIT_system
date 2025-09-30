use ticketing_system::auth::types::UserStatus;

use crate::helpers::spawn_app;

#[tokio::test]
async fn refresh_token_returns_200() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn refresh_token_returns_data() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();
        

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("access_token").is_some()
        && json.get("refresh_token").is_some()
        && json.get("token_type").is_some()
        && json.get("expires_in").is_some()
    )
}

#[tokio::test]
async fn refresh_token_with_same_token_returns_401() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn refresh_token_with_db_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    sqlx::query!(
        "DROP TABLE users CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn refresh_token_returns_correct_access_token() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    let access = json["access_token"].as_str().unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn refresh_token_with_disabled_user_returns_403() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (_, refresh) = app.get_jwt_tokens(&email, "admin").await;

    app.change_user_status(2, UserStatus::Inactive).await;

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/auth/token", app.address))
        .json(&serde_json::json!({
            "refresh_token": refresh,
            "fingerprint": "something"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 403);
}