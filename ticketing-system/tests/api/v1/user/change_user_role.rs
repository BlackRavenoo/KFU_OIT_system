use crate::helpers::{NEXT_USER_ID, TestApp, spawn_app};

async fn change_user_role(app: &TestApp, body: &serde_json::Value, access: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .patch(format!("{}/v1/user/admin/role", app.address));

    if let Some(access) = access {
        builder = builder.bearer_auth(access);
    }

    builder
        .json(body)
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn change_user_role_returns_200() {
    let app = spawn_app().await;

    app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "id": 2,
        "role": "moderator",
    });

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn change_user_role_for_non_existent_user_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "id": NEXT_USER_ID,
        "role": "moderator",
    });

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}


#[tokio::test]
async fn change_user_role_for_low_role_returns_403() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "id": 1,
        "role": "moderator",
    });

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn change_user_role_for_equal_role_user_returns_400() {
    let app = spawn_app().await;

    app.create_user(ticketing_system::auth::types::UserRole::Admin).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "id": NEXT_USER_ID,
        "role": "moderator",
    });

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn change_user_role_to_admin_returns_403() {
    let app = spawn_app().await;

    app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "id": 2,
        "role": "admin",
    });

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn change_user_role_with_db_error_returns_500() {
    let app = spawn_app().await;

    app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "id": 2,
        "role": "moderator",
    });

    sqlx::query!("DROP TABLE users CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = change_user_role(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}