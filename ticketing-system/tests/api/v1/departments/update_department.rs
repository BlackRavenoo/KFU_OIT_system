use crate::helpers::spawn_app;

async fn update_department(address: &str, body: &serde_json::Value, id: i16, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!("{}/v1/departments/{}", address, id))
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
async fn update_department_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Тестовый отдел"
    });

    let resp = update_department(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_department_with_wrong_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(81)
    });

    let resp = update_department(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_department_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "name": "Тестовый отдел"
    });

    let resp = update_department(&app.address, &body, 1, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn update_department_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Тестовый отдел"
    });

    sqlx::query!("DROP TABLE departments CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = update_department(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_department_without_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = update_department(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}