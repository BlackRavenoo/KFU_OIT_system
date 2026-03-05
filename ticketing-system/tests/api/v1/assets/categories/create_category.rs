use crate::helpers::spawn_app;

#[tokio::test]
async fn create_category_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test category",
        "color": "#FFFFFF",
        "notes": "Test"
    });

    let resp = app.create_category(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_category_returns_id() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test category",
        "color": "#FFFFFF",
        "notes": "Test"
    });

    let resp = app.create_category(
        &body,
        Some(&access)
    )
    .await;

    let json: serde_json::Value = resp.json()
        .await
        .unwrap();

    assert!(json["id"].is_number())
}

#[tokio::test]
async fn create_category_with_invalid_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "T".repeat(33),
        "color": "#FFFFFF",
        "notes": "Test"
    });

    let resp = app.create_category(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_category_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test category",
        "color": "#FFFFFF",
        "notes": "Test"
    });

    sqlx::query!("DROP TABLE asset_categories CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.create_category(
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}