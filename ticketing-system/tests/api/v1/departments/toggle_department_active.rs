use crate::helpers::spawn_app;

async fn toggle_department_active(address: &str, id: i16, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/departments/{}/toggle_active", address, id));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn toggle_department_active_flips_flag() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let before = sqlx::query!(
        "SELECT is_active FROM departments WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .is_active;

    let resp = toggle_department_active(&app.address, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);

    let after = sqlx::query!(
        "SELECT is_active FROM departments WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .is_active;

    assert_ne!(before, after);
}

#[tokio::test]
async fn toggle_department_active_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE departments CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = toggle_department_active(&app.address, 1, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}
