use crate::helpers::{TestApp, spawn_app};

async fn update_building(app: &TestApp, body: &serde_json::Value, id: i16, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .put(format!("{}/v1/buildings/{}", app.address, id))
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
async fn update_building_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let body = serde_json::json!({
        "code": "TEST"
    });

    let resp = update_building(&app, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_building_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let body = serde_json::json!({});

    let resp = update_building(&app, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_building_with_wrong_code_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let body = serde_json::json!({
        "code": "TESTTEST"
    });

    let resp = update_building(&app, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_building_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    sqlx::query!("DROP TABLE buildings CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();
    
    let body = serde_json::json!({
        "code": "TEST"
    });

    let resp = update_building(&app, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_nonexistent_building_returns_404() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;
    
    let body = serde_json::json!({
        "code": "TEST"
    });

    let resp = update_building(&app, &body, 999, Some(&access)).await;

    assert_eq!(resp.status(), 404);
}

#[tokio::test]
async fn update_building_updates_building() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let code = sqlx::query!(
        "SELECT code FROM buildings
        WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .code;

    assert_ne!("TEST", code);
    
    let body = serde_json::json!({
        "code": "TEST"
    });

    update_building(&app, &body, 1, Some(&access))
        .await
        .error_for_status()
        .unwrap();

    let code = sqlx::query!(
        "SELECT code FROM buildings
        WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .code;

    assert_eq!("TEST", code);
}