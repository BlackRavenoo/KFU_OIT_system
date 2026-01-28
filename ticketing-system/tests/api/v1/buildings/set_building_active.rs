use crate::helpers::spawn_app;

async fn set_building_active(address: &str, body: &serde_json::Value, id: i16, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .post(format!("{}/v1/buildings/{}/set_active", address, id))
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
async fn set_building_active_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "is_active": false,
    });

    let resp = set_building_active(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn set_building_active_updates_building() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "is_active": false,
    });

    let is_active = sqlx::query!(
        "SELECT is_active FROM buildings
        WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .is_active;

    assert_eq!(is_active, true);

    set_building_active(&app.address, &body, 1, Some(&access)).await;

    let is_active = sqlx::query!(
        "SELECT is_active FROM buildings
        WHERE id = 1"
    )
    .fetch_one(&app.db_pool)
    .await
    .unwrap()
    .is_active;

    assert_eq!(is_active, false);
}

#[tokio::test]
async fn set_building_active_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = set_building_active(&app.address, &body, 1, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}