use crate::helpers::{TestApp, spawn_app};

async fn get_assets(app: &TestApp, body: &serde_json::Value, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .get(format!(
            "{}/v1/assets?{}",
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
async fn get_assets_without_filters_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_assets_with_big_filters_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let body = serde_json::json!({
        "model_id": model_id,
        "status": 1,
        "name": "abc",
        "serial_number": "1234",
        "inventory_number": "1234",
        "location": "Test",
        "assigned_to": "Test",
        "ip": "172.16.20.10 - 172.16.20.30",
        "mac": "00:1a:2b:3c:4d:5e"
    });

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_assets_with_ip_exact_filter_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    sqlx::query!(
        "INSERT INTO assets(model_id, status, name, ip)
        VALUES ($1, 1, 'Test Asset 1', '172.16.20.10'::inet),
        ($1, 1, 'Test Asset 2', '172.16.20.20'::inet),
        ($1, 1, 'Test Asset 3', '172.16.20.30'::inet)",
        model_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let body = serde_json::json!({"ip": "172.16.20.20"});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(json["items"].as_array().unwrap().len(), 1);
    assert_eq!(json["items"][0]["ip"], "172.16.20.20");
}

#[tokio::test]
async fn get_assets_with_ip_cidr_filter_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    sqlx::query!(
        r#"
            INSERT INTO assets(model_id, status, name, ip)
            VALUES ($1, 1, 'Test Asset 1', '172.16.20.10'::inet),
                   ($1, 1, 'Test Asset 2', '172.16.20.20'::inet),
                   ($1, 1, 'Test Asset 3', '172.16.21.30'::inet)
        "#,
        model_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let body = serde_json::json!({"ip": "172.16.20.0/24"});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);
    
    let json: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(json["items"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn get_assets_with_ip_range_filter_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    sqlx::query!(
        r#"
            INSERT INTO assets(model_id, status, name, ip)
            VALUES ($1, 1, 'Test Asset 1', '172.16.20.5'::inet),
                   ($1, 1, 'Test Asset 2', '172.16.20.15'::inet),
                   ($1, 1, 'Test Asset 3', '172.16.20.25'::inet)
        "#,
        model_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let body = serde_json::json!({"ip": "172.16.20.10-172.16.20.20"});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(json["items"].as_array().unwrap().len(), 1);
    assert_eq!(json["items"][0]["ip"], "172.16.20.15");
}


#[tokio::test]
async fn get_assets_with_invalid_page_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({"page": -2});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_assets_with_invalid_page_size_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({"page_size": 200});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_assets_with_bad_ip_field_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "ip": "something"
    });

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_assets_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!(
        "DROP TABLE assets CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let body = serde_json::json!({});

    let resp = get_assets(&app, &body, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}