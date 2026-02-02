use crate::helpers::spawn_app;

async fn create_department(address: &str, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/departments/", address))
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
async fn create_department_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Тестовый отдел"
    });

    let resp = create_department(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_department_with_bad_name_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "a".repeat(81)
    });

    let resp = create_department(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_department_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = create_department(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_department_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Тестовый отдел"
    });

    sqlx::query!("DROP TABLE departments CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = create_department(&app.address, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}