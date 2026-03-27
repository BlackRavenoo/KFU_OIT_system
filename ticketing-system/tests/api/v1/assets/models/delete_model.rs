use ticketing_system::schema::assets::ModelId;

use crate::helpers::{TestApp, spawn_app};

async fn delete_model(app: &TestApp, id: ModelId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!(
            "{}/v1/assets/models/{}",
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
async fn delete_model_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let resp = delete_model(
        &app,
        model_id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_model_with_nonexistent_model_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = delete_model(
        &app,
        9999,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_model_without_token_returns_401() {
    let app = spawn_app().await;

    let model_id = app.create_test_model().await;

    let resp = delete_model(
        &app,
        model_id,
        None
    )
    .await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn delete_model_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    sqlx::query!(
        "DROP TABLE asset_models CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = delete_model(
        &app,
        model_id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}
