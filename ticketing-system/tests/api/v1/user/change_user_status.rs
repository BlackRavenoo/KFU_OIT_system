use crate::helpers::{spawn_app, TestApp};
use ticketing_system::auth::types::UserRole;

async fn patch_change_status(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .patch(format!("{}/v1/user/status", app.address))
        .json(body);

    if let Some(t) = token {
        builder = builder.bearer_auth(t);
    }

    builder.send().await.unwrap()
}

#[tokio::test]
async fn admin_can_change_other_user_status() {
    let app = spawn_app().await;

    let target_email = app.create_user(UserRole::Employee).await;
    let target_id: i32 = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", target_email)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    let (admin_access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({"id": target_id, "status": "sick"});

    let resp = patch_change_status(&app, &body, Some(&admin_access)).await;

    assert_eq!(resp.status().as_u16(), 200);

    let status: i16 = sqlx::query_scalar!("SELECT status FROM users WHERE id = $1", target_id)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    assert_eq!(status, ticketing_system::auth::types::UserStatus::Sick as i16);
}

#[tokio::test]
async fn employee_cannot_change_other_user_status() {
    let app = spawn_app().await;

    let actor_email = app.create_user(UserRole::Employee).await;
    let actor_tokens = app.get_jwt_tokens(&actor_email, "admin").await;

    let target_email = app.create_user(UserRole::Employee).await;
    let target_id: i32 = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", target_email)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    let body = serde_json::json!({"id": target_id, "status": "vacation"});

    let resp = patch_change_status(&app, &body, Some(&actor_tokens.0)).await;

    assert_eq!(resp.status().as_u16(), 403);
}
