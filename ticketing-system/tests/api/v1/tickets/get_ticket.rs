use crate::helpers::spawn_app;

#[tokio::test]
async fn get_ticket_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    app.create_test_ticket().await;

    let resp = app.get_ticket(1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_ticket_with_insufficient_permissions_returns_403() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    app.create_test_ticket().await;

    let resp = app.get_ticket(1, Some(&access)).await;

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn get_nonexistent_ticket_returns_404() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = app.get_ticket(1000, Some(&access)).await;

    assert_eq!(resp.status(), 404);
}

#[tokio::test]
async fn get_ticket_by_author_returns_200() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let json = serde_json::json!({
        "title": "Test",
        "description": "Test description",
        "author": "Test author",
        "author_contacts": "Test contacts",
        "building_id": 1,
        "department_id": 1,
    });

    app.create_ticket(&json, None, Some(&access)).await;

    let resp = app.get_ticket(1, Some(&access)).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_ticket_by_author_returns_data() {
    let app = spawn_app().await;

    let email = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let (access, _) = app.get_jwt_tokens(&email, "admin").await;

    let body = serde_json::json!({
        "title": "Test",
        "description": "Test description",
        "author": "Test author",
        "author_contacts": "Test contacts",
        "building_id": 1,
        "department_id": 1,
    });

    app.create_ticket(&body, None, Some(&access)).await;

    let resp = app.get_ticket(1, Some(&access)).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json["title"] == body["title"]
        && json["description"] == body["description"]
        && json["author"] == body["author"]
        && json["author_contacts"] == body["author_contacts"]
    )
}