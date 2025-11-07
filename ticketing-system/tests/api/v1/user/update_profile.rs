use crate::helpers::{NEXT_USER_ID, TestApp, spawn_app};

async fn update_profile(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!("{}/v1/user/profile", app.address))
        .json(body);

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn update_profile_returns_200() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
    });

    let resp = update_profile(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_profile_updates_data() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
        "name": "Иван Иванов",
        "login": "some_login",
    });

    update_profile(&app, &body, Some(&access)).await;

    let fields = sqlx::query!(
        "
            SELECT email, name, login
            FROM users
            WHERE id = $1
        ",
        NEXT_USER_ID
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap();

    assert_eq!(&fields.email, body["email"].as_str().unwrap());
    assert_eq!(&fields.name, body["name"].as_str().unwrap());
    assert_eq!(&fields.login, body["login"].as_str().unwrap());
}

#[tokio::test]
async fn update_profile_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
    });

    let resp = update_profile(&app, &body, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn update_profile_with_empty_json_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({});

    let resp = update_profile(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_profile_with_wrong_email_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "email": "wrong_email",
    });

    let resp = update_profile(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_profile_with_db_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
    });

    sqlx::query!("
        DROP TABLE users CASCADE
    ")
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = update_profile(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_profile_with_wrong_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
    });

    let resp = update_profile(&app, &body, Some("wrong_token")).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn update_profile_with_empty_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "email": "some_email@example.com",
    });

    let resp = update_profile(&app, &body, Some("")).await;

    assert_eq!(resp.status(), 401);
}