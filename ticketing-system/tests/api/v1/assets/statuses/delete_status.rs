use ticketing_system::schema::assets::StatusId;

use crate::helpers::{TestApp, spawn_app};

async fn delete_status(app: &TestApp, id: StatusId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!(
            "{}/v1/assets/statuses/{}",
            app.address,
            id
        ));

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn delete_status_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let status_id = app.create_test_status().await;

    let resp = delete_status(&app, status_id, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_nonexist_status_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = delete_status(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_status_without_token_returns_401() {
    let app = spawn_app().await;

    let status_id = app.create_test_status().await;

    let resp = delete_status(&app, status_id, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn delete_status_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let status_id = app.create_test_status().await;

    sqlx::query!("DROP TABLE asset_statuses CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = delete_status(&app, status_id, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}
