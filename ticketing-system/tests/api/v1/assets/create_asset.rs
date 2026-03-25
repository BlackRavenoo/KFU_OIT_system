use crate::helpers::{spawn_app, Attachment};
use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

#[tokio::test]
async fn create_asset_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "333",
        "inventory_number": "67",
        "status": 1,
        "location": "Test",
        "assigned_to": "Test",
        "model_id": model_id,
        "ip": "172.16.20.11",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let resp = app.create_asset(
        &body,
        None,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_asset_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({});

    let resp = app.create_asset(
        &body,
        None,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_asset_without_token_returns_401() {
    let app = spawn_app().await;

    let model_id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "333",
        "inventory_number": "67",
        "status": 1,
        "location": "Test",
        "assigned_to": "Test",
        "model_id": model_id,
        "ip": "172.16.20.11",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let resp = app.create_asset(
        &body,
        None,
        None
    )
    .await;

    assert_eq!(resp.status(), 401);
}


#[tokio::test]
async fn create_asset_with_nonexist_model_returns_409() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "name": "Test",
        "status": 1,
        "model_id": 9999
    });

    let resp = app.create_asset(
        &body,
        None,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 409);
}

#[tokio::test]
async fn create_asset_with_nonexist_model_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
        "status": 1,
        "model_id": model_id
    });

    sqlx::query!("DROP TABLE assets CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.create_asset(
        &body,
        None,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn create_asset_with_photo_returns_201() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "333",
        "inventory_number": "67",
        "status": 1,
        "location": "Test",
        "assigned_to": "Test",
        "model_id": model_id,
        "ip": "172.16.20.11",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let photo = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_asset(
        &body,
        Some(photo),
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_asset_with_empty_photo_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "333",
        "inventory_number": "67",
        "status": 1,
        "location": "Test",
        "assigned_to": "Test",
        "model_id": model_id,
        "ip": "172.16.20.11",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let photo = Attachment::from_filename(
        vec![],
        "empty.png"
    );

    let resp = app.create_asset(
        &body,
        Some(photo),
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn create_asset_with_s3_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0..=1)
        .mount(&app.s3_server)
        .await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "333",
        "inventory_number": "67",
        "status": 1,
        "location": "Test",
        "assigned_to": "Test",
        "model_id": model_id,
        "ip": "172.16.20.11",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let photo = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_asset(
        &body,
        Some(photo),
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}