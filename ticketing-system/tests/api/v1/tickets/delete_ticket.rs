use std::time::Duration;

use ticketing_system::schema::tickets::TicketId;
use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

use crate::helpers::{spawn_app, Attachment, TestApp};

async fn create_ticket_with_attachments(app: &TestApp) {
    let json = serde_json::json!({
        "title": "Title",
        "description": "Description",
        "author": "Author",
        "author_contacts": "79999999999",
        "building_id": 1,
        "department_id": 1,
    });

    let _mock_guard = Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(2)
        .mount_as_scoped(&app.s3_server)
        .await;

    let attachment = Attachment::from_filename(
        include_bytes!("../../../../../www/static/KFU.png").into(),
        "KFU.png"
    );

    let resp = app.create_ticket_from_admin(&json, Some(vec![attachment; 2])).await;

    assert_eq!(resp.status(), 201);
}

async fn delete_ticket(app: &TestApp, ticket_id: TicketId, token: Option<&str>) -> reqwest::Response {
    let mut builder = reqwest::Client::new()
        .delete(format!("{}/v1/tickets/{}", app.address, ticket_id));
        
    if let Some(token) = token {
        builder = builder.bearer_auth(token);
    }

    builder
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn delete_ticket_returns_200() {
    let app = spawn_app().await;

    create_ticket_with_attachments(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0..=2)
        .mount(&app.s3_server)
        .await;

    let resp = delete_ticket(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_ticket_deletes_attachments() {
    let app = spawn_app().await;

    create_ticket_with_attachments(&app).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path_regex(r"/test-bucket/attachments/.*\.webp"))
        .and(method("DELETE"))
        .respond_with(ResponseTemplate::new(200))
        .expect(2)
        .mount(&app.s3_server)
        .await;

    let resp = delete_ticket(&app, 1, Some(&access)).await;

    tokio::time::sleep(Duration::from_millis(100)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn delete_ticket_with_db_error_returns_500() {
    let app = spawn_app().await;

    app.create_test_ticket().await.error_for_status().unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("
        DROP TABLE tickets CASCADE
    ")
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = delete_ticket(&app, 1, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}