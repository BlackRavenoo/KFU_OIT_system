use crate::helpers::{create_invitation, spawn_app, TestApp};

async fn register(app: &TestApp, body: &serde_json::Value) -> reqwest::Response {
    reqwest::Client::new()
        .post(format!("{}/v1/auth/register", app.address))
        .json(body)
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn register_returns_200() {
    let app = spawn_app().await;

    let (_, token) = create_invitation(&app).await;

    let resp = register(&app, &serde_json::json!({
        "name": "Олег",
        "login": "some_login",
        "password": "some_pass1",
        "token": token
    })).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn register_with_wrong_token_returns_401() {
    let app = spawn_app().await;

    let resp = register(&app, &serde_json::json!({
        "name": "Олег",
        "login": "some_login",
        "password": "some_pass1",
        "token": "abcabc"
    })).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn register_with_same_token_twice_returns_401() {
    let app = spawn_app().await;

    let (_, token) = create_invitation(&app).await;

    let body = serde_json::json!({
        "name": "Олег",
        "login": "some_login",
        "password": "some_pass1",
        "token": token
    });

    register(&app, &body).await;

    let resp = register(&app, &body).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn register_with_wrong_name_returns_400() {
    let app = spawn_app().await;

    let (_, token) = create_invitation(&app).await;

    let resp = register(&app, &serde_json::json!({
        "name": "Sam",
        "login": "some_login",
        "password": "some_pass1",
        "token": token
    })).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn register_with_existing_email_returns_400() {
    let app = spawn_app().await;

    let (email, token) = create_invitation(&app).await;

    sqlx::query!(
        "INSERT INTO users(name, email, login, password_hash)
        VALUES('Олег', $1, 'some_login', 'something')",
        email
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = register(&app, &serde_json::json!({
        "name": "Олег",
        "login": "some_login",
        "password": "some_pass1",
        "token": token
    })).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn register_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (_, token) = create_invitation(&app).await;

    sqlx::query!("
        DROP TABLE users CASCADE
    ")
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = register(&app, &serde_json::json!({
        "name": "Олег",
        "login": "some_login",
        "password": "some_pass1",
        "token": token
    })).await;

    assert_eq!(resp.status(), 500);
}