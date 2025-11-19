use crate::helpers::spawn_app;

#[tokio::test]
async fn create_page_returns_201() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = app.create_page(&body, Some(&access), 1).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_page_returns_id() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = app.create_page(&body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(json.get("id").unwrap().as_i64().is_some());
}

#[tokio::test]
async fn create_page_returns_incremented_id() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = app.create_page(&body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let id1 = json.get("id").unwrap().as_i64().unwrap();

    let resp = app.create_page(&body, Some(&access), 1).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let id2 = json.get("id").unwrap().as_i64().unwrap();

    assert_eq!(id1 + 1, id2);
}

#[tokio::test]
async fn create_page_without_token_returns_401() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = app.create_page(&body, None, 0).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn create_page_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let resp = app.create_page(&serde_json::json!({}), Some(&access), 0).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_page_with_related_returns_201() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

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

    let body = serde_json::json!({
        "data": {
            "text": "Some text"
        },
        "title": "Test title",
        "tags": [],
        "related": [1],
        "is_public": true
    });

    let resp = app.create_page(&body, Some(&access), 1).await;

    assert_eq!(resp.status(), 201);
}