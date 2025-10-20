use crate::helpers::spawn_app;

#[tokio::test]
async fn me_returns_200() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn me_returns_correct_data() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("id").is_some()
        && json.get("name").is_some()
        && json.get("email").is_some()
        && json.get("role").is_some()
    )
}

#[tokio::test]
async fn me_returns_401_for_non_existent_user() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    sqlx::query!(
        "DELETE FROM users
        WHERE id = 2"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn me_returns_401_without_token() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn me_with_db_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    sqlx::query!(
        "DROP TABLE users CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn me_returns_avatar_field_only_if_exists() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(&access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("avatar_key").is_none()
    );

    app.update_avatar(Some(&access), include_bytes!("../../../../../www/static/KFU.png").into()).await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/auth/me", app.address))
        .bearer_auth(&access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("avatar_key").is_some()
    );
}