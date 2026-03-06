use ticketing_system::schema::assets::CategoryId;

use crate::helpers::{TestApp, spawn_app};

async fn delete_category(app: &TestApp, id: CategoryId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!(
            "{}/v1/assets/categories/{}",
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
async fn delete_category_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_category().await;

    let resp = delete_category(
        &app,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_category_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_category().await;

    sqlx::query!("DROP TABLE asset_categories CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = delete_category(
        &app,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}