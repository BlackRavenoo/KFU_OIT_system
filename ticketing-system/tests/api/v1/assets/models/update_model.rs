use ticketing_system::schema::assets::ModelId;

use crate::helpers::{TestApp, spawn_app};

async fn update_model(app: &TestApp, body: &serde_json::Value, id: ModelId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!(
            "{}/v1/assets/models/{}",
            app.address,
            id
        ))
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
async fn update_model_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
    });

    let resp = update_model(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_model_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_model().await;

    let body = serde_json::json!({});

    let resp = update_model(
        &app,
        &body,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_model_with_wrong_params_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let id = app.create_test_model().await;

    let test_values = vec![
        serde_json::json!({
            "name": "a".repeat(129),
        }),
        serde_json::json!({
            "category": -1,
        }),
    ];

    for body in test_values {
        let resp = update_model(
            &app,
            &body,
            id,
            Some(&access)
        )
        .await;
    
        assert_eq!(resp.status(), 400);
    }
}

#[tokio::test]
async fn update_model_without_token_returns_401() {
    let app = spawn_app().await;

    let id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
    });

    let resp = update_model(
        &app,
        &body,
        id,
        None
    )
    .await;

    assert_eq!(resp.status(), 401);
}