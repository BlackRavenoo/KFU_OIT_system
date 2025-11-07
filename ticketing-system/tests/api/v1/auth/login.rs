use crate::helpers::{NEXT_USER_ID, spawn_app};

#[tokio::test]
async fn login_returns_200() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let body = serde_json::json!({
        "login": email,
        "password": "admin",
        "fingerprint": "something",
    });

    let resp = app.login(&body).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn login_returns_tokens() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let body = serde_json::json!({
        "login": email,
        "password": "admin",
        "fingerprint": "something",
    });

    let resp = app.login(&body).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("access_token").is_some()
        && json.get("refresh_token").is_some()
        && json.get("token_type").is_some()
        && json.get("expires_in").is_some()
    )
}

#[tokio::test]
async fn login_with_wrong_password_returns_401() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let body = serde_json::json!({
        "login": email,
        "password": "admin123",
        "fingerprint": "something",
    });

    let resp = app.login(&body).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn login_for_deactived_user_returns_403() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    app.deactivate_user_account(NEXT_USER_ID).await;

    let body = serde_json::json!({
        "login": email,
        "password": "admin",
        "fingerprint": "something",
    });

    let resp = app.login(&body).await;

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn login_with_db_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let body = serde_json::json!({
        "login": email,
        "password": "admin",
        "fingerprint": "something",
    });

    sqlx::query!(
        "DROP TABLE users CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = app.login(&body).await;

    assert_eq!(resp.status(), 500);
}