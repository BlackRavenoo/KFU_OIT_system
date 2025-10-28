use crate::helpers::{TestApp, spawn_app};

async fn create_test_page(app: &TestApp) {
    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    app.create_page(&body, Some(&access), 1).await;
}

async fn create_private_page(app: &TestApp) {
    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": false
    });

    app.create_page(&body, Some(&access), 1).await;
}

#[tokio::test]
async fn get_pages_returns_200() {
    let app = spawn_app().await;

    let resp = app.get_pages(&serde_json::json!({}), None).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_pages_returns_pages() {
    let app = spawn_app().await;

    let resp = app.get_pages(&serde_json::json!({}), None).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(json.get("items").is_some());
}

#[tokio::test]
async fn get_pages_returns_correct_items_count() {
    let app = spawn_app().await;

    for _ in 0..10 {
        create_test_page(&app).await;
    }

    let resp = app.get_pages(&serde_json::json!({}), None).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let items_count = json["items"].as_array().unwrap().len();

    assert_eq!(items_count, 10);
}

#[tokio::test]
async fn get_pages_with_invalid_page_returns_400() {
    let app = spawn_app().await;

    let resp = app.get_pages(
        &serde_json::json!({
            "page": -1
        }),
        None
    ).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_pages_with_db_error_returns_500() {
    let app = spawn_app().await;

    sqlx::query!("DROP TABLE pages CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.get_pages(&serde_json::json!({}),None).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn get_pages_returns_only_public_pages_for_user_without_token() {
    let app = spawn_app().await;

    for _ in 0..5 {
        create_test_page(&app).await;
    }

    for _ in 0..5 {
        create_private_page(&app).await;
    }

    let resp = app.get_pages(&serde_json::json!({}), None).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let items_count = json["items"].as_array().unwrap().len();

    assert_eq!(items_count, 5);
}