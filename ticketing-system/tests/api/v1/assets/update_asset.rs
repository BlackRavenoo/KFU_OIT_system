use ticketing_system::schema::assets::AssetId;
use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

use crate::helpers::{TestApp, spawn_app, Attachment};

async fn update_asset(app: &TestApp, body: &serde_json::Value, photo: Option<Attachment>, id: AssetId, token: Option<&str>) -> reqwest::Response {
    let json_string = serde_json::to_string(body).unwrap();

    let mut form = reqwest::multipart::Form::new();

    form = form.part("fields",
        reqwest::multipart::Part::text(json_string)
            .mime_str("application/json")
            .unwrap()
    );

    if let Some(photo) = photo {
        form = form.part(
            "photo",
            reqwest::multipart::Part::bytes(photo.data)
                .file_name(photo.filename)
                .mime_str(&photo.mime_type)
                .unwrap()
        );
    }

    let mut builder = reqwest::Client::new()
        .put(format!(
            "{}/v1/assets/{}",
            app.address,
            id
        ))
        .multipart(form);

    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn update_asset_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
    });

    let resp = update_asset(
        &app,
        &body,
        None,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_asset_with_all_fields_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": model_id,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D:5E",
    });

    let resp = update_asset(
        &app,
        &body,
        None,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_asset_with_wrong_mac_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": model_id,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D",
    });

    let resp = update_asset(
        &app,
        &body,
        None,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_asset_with_wrong_model_id_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
        "description": "Test",
        "serial_number": "12345",
        "inventory_number": "12345",
        "status": 2,
        "location": "Somewhere",
        "assigned_to": "Someone",
        "model_id": 999,
        "ip": "172.16.20.12",
        "mac": "00:1A:2B:3C:4D",
    });

    let resp = update_asset(
        &app,
        &body,
        None,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_asset_returns_with_db_err_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Test",
    });

    sqlx::query!("DROP TABLE assets CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = update_asset(
        &app,
        &body,
        None,
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_asset_with_photo_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let body = serde_json::json!({
        "name": "Updated name",
    });

    let photo = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = update_asset(
        &app,
        &body,
        Some(photo),
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_asset_with_photo_replaces_old_photo() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let photo = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    {
        let _mock_guard = Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
            .and(method("PUT"))
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount_as_scoped(&app.s3_server)
            .await;
    
        let create_body = serde_json::json!({
            "name": "Test asset",
            "status": 1,
            "model_id": model_id
        });
    
        app.create_asset(
            &create_body,
            Some(photo.clone()),
            Some(&access)
        )
        .await;
    }
    
    {
        Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
            .and(method("PUT"))
            .respond_with(ResponseTemplate::new(200))
            .expect(1)
            .mount(&app.s3_server)
            .await;
    
        let update_body = serde_json::json!({
            "name": "Updated name",
        });
    
        let resp = update_asset(
            &app,
            &update_body,
            Some(photo),
            id,
            Some(&access)
        )
        .await;
    
        assert_eq!(resp.status(), 200);
    }

}

#[tokio::test]
async fn update_asset_with_empty_photo_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    let body = serde_json::json!({
        "name": "Updated name",
    });

    let photo = Attachment::from_filename(
        vec![],
        "empty.png"
    );

    let resp = update_asset(
        &app,
        &body,
        Some(photo),
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn update_asset_with_s3_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let model_id = app.create_test_model().await;

    let id = app.create_test_asset(model_id).await;

    Mock::given(path_regex(r"/test-bucket/assets/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let body = serde_json::json!({
        "name": "Updated name",
    });

    let photo = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = update_asset(
        &app,
        &body,
        Some(photo),
        id,
        Some(&access)
    )
    .await;

    assert_eq!(resp.status(), 500);
}