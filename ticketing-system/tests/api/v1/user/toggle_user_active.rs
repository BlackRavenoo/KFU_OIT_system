use crate::helpers::spawn_app;

#[tokio::test]
async fn activate_account_sets_is_active_true() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Employee).await;
    let user_id: i32 = sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    // set is_active = false
    sqlx::query!("UPDATE users SET is_active = false WHERE id = $1", user_id)
        .execute(&app.db_pool)
        .await
        .unwrap();

    let (admin_access, _) = app.get_admin_jwt_tokens().await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/v1/user/{}/activate", app.address, user_id))
        .bearer_auth(&admin_access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status().as_u16(), 200);

    let is_active: bool = sqlx::query_scalar!("SELECT is_active FROM users WHERE id = $1", user_id)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    assert!(is_active);
}

#[tokio::test]
async fn activate_nonexistent_returns_404() {
    let app = spawn_app().await;

    let (admin_access, _) = app.get_admin_jwt_tokens().await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/v1/user/{}/activate", app.address, 99999))
        .bearer_auth(&admin_access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status().as_u16(), 404);
}
