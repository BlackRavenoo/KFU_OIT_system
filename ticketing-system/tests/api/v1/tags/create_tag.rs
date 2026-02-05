use crate::helpers::spawn_app;

#[tokio::test]
async fn create_tag_returns_201() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({
        "name": "Test tag",
        "synonyms": []
    });

    let resp = app.create_tag(&json, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_tag_with_synonyms_returns_201() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({
        "name": "Test tag",
        "synonyms": ["Test", "TestTest"]
    });

    let resp = app.create_tag(&json, Some(&access)).await;

    assert_eq!(resp.status(), 201);
}

#[tokio::test]
async fn create_tag_without_token_returns_401() {
    let app = spawn_app().await;

    let json = serde_json::json!({
        "name": "Test tag",
        "synonyms": []
    });

    let resp = app.create_tag(&json, None).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn create_tag_with_db_error_returns_500() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({
        "name": "Test tag",
        "synonyms": []
    });

    sqlx::query!("DROP TABLE tags CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.create_tag(&json, Some(&access)).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn create_tag_with_empty_body_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({});

    let resp = app.create_tag(&json, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn create_tag_with_wrong_tag_name_returns_400() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Moderator).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({
        "name": "tg",
        "synonyms": []
    });

    let resp = app.create_tag(&json, Some(&access)).await;

    assert_eq!(resp.status(), 400);
}