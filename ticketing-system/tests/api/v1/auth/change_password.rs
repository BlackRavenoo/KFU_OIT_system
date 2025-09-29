use crate::helpers::{spawn_app, TestApp};

async fn change_password(
    app: &TestApp,
    body: &serde_json::Value,
) -> reqwest::Response {
    let (access, _) = app.get_admin_jwt_tokens().await;

    reqwest::Client::new()
        .put(format!("{}/v1/user/password", app.address))
        .json(body)
        .bearer_auth(access)
        .send()
        .await
        .expect("Failed to change password")
}

#[tokio::test]
async fn change_password_returns_200() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "current_password": "admin",
        "new_password": "admin123",
    });

    let resp = change_password(&app, &body).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn change_password_with_wrong_password_returns_400() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "current_password": "admin1",
        "new_password": "admin123",
    });

    let resp = change_password(&app, &body).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn change_password_with_db_error_returns_500() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "current_password": "admin",
        "new_password": "admin123",
    });

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    sqlx::query!(
        "DROP TABLE users CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .put(format!("{}/v1/user/password", app.address))
        .json(&body)
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}