use crate::helpers::spawn_app;

#[tokio::test]
async fn create_model_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test name",
        "category": 3
    });

    let resp = app.create_model(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_model_with_wrong_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(129),
        "category": 3
    });

    let resp = app.create_model(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_model_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = app.create_model(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_model_with_wrong_category_returns_409() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(10),
        "category": 999
    });

    let resp = app.create_model(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 409);
}

#[tokio::test]
async fn create_model_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(10),
        "category": 2
    });

    sqlx::query!(
        "DROP TABLE asset_models CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = app.create_model(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}