use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

use crate::helpers::{spawn_app, Attachment};

#[tokio::test]
async fn create_ticket_returns_201() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    let resp = app.create_ticket(&json, None).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_ticket_with_invalid_attachments_returns_400() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let attachment1 = Attachment::from_filename(
        vec![0xFF],
        "test.pdf"
    );

    let attachment2 = Attachment::from_filename(
        vec![0xFF],
        "test.jpg"
    );

    let resp = app.create_ticket(&json, Some(vec![attachment1, attachment2])).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_ticket_with_a_lot_of_attachments_returns_400() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let attachment = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_ticket(&json, Some(vec![attachment; 6])).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_ticket_with_images_returns_201() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let attachment = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_ticket(&json, Some(vec![attachment])).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_ticket_with_db_error_returns_500() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    sqlx::query!(
        "DROP TABLE tickets CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = app.create_ticket(&json, None).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn create_ticket_with_s3_error_returns_500() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .up_to_n_times(1)
        .mount(&app.s3_server)
        .await;

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(500))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0..=1)
        .mount(&app.s3_server)
        .await;

    let attachment = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_ticket(&json, Some(vec![attachment; 2])).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn create_ticket_with_empty_attachment_returns_400() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
    });

    let attachment = Attachment::from_filename(
        vec![],
        "test.png"
    );

    let resp = app.create_ticket(&json, Some(vec![attachment])).await;

    assert_eq!(resp.status(), 400);
}