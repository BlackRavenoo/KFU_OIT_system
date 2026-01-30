use crate::helpers::spawn_app;

async fn create_building(address: &str, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/buildings/", address))
        .json(body);
    
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn create_building_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "code": "TEST",
        "name": "Тестовое здание"
    });

    let resp = create_building(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_building_with_empty_json_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = create_building(&app.address, &serde_json::json!({}), Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_building_with_wrong_code_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "code": "TESTTEST",
        "name": "Тестовое здание"
    });

    let resp = create_building(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_building_with_existing_code_returns_409() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "code": "BIO",
        "name": "Тестовое здание"
    });

    let resp = create_building(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 409);
}

#[tokio::test]
async fn create_building_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "code": "TEST",
        "name": "Тестовое здание"
    });

    let resp = create_building(&app.address, &body, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn create_building_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("DROP TABLE buildings CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let body = serde_json::json!({
        "code": "TEST",
        "name": "Тестовое здание"
    });

    let resp = create_building(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}