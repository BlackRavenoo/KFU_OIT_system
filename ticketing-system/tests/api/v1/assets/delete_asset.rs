use ticketing_system::schema::assets::AssetId;

use crate::helpers::{TestApp, spawn_app};

async fn delete_asset(app: &TestApp, id: AssetId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!(
            "{}/v1/assets/{}",
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
async fn delete_asset_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let asset_id = app.create_test_asset(model_id).await;

    let resp = delete_asset(&app, asset_id, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_nonexist_asset_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = delete_asset(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_asset_without_token_returns_401() {
    let app = spawn_app().await;

    let model_id = app.create_test_model().await;

    let asset_id = app.create_test_asset(model_id).await;

    let resp = delete_asset(&app, asset_id, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn delete_asset_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let asset_id = app.create_test_asset(model_id).await;

    sqlx::query!("DROP TABLE assets CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = delete_asset(&app, asset_id, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}