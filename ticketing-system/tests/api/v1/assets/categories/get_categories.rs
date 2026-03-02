use crate::helpers::{TestApp, spawn_app};

async fn get_categories(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .get(format!(
            "{}/v1/assets/categories?{}",
            app.address,
            serde_qs::to_string(body).unwrap()
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
async fn get_categories_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = get_categories(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_categories_returns_categories() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = get_categories(
        &app,
        &body,
        Some(&access)
    )
    .await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(json["items"].is_array());
}

#[tokio::test]
async fn get_categories_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    sqlx::query!("DROP TABLE asset_categories CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();
    
    let resp = get_categories(
        &app,
        &body,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn get_categories_with_bad_params_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let bad_params = vec![
        ("page", -1),
        ("page_size", 5),
        ("page_size", 200)
    ];

    for (name, value) in bad_params.iter() {
        let body = serde_json::json!({ *name: value });

        let resp = get_categories(
            &app,
            &body,
            Some(&access)
        )
        .await;

        assert_eq!(resp.status(), 400);
    }
}