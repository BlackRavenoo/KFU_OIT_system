use crate::helpers::spawn_app;

#[tokio::test]
async fn get_users_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_users_returns_data() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("max_page").is_some()
        && json.get("total_items").is_some()
        && json.get("items").is_some()
    );
}

#[tokio::test]
async fn get_users_with_negative_page_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list?page=-2", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_users_with_db_error_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!(
        "DROP TABLE users CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn get_users_clamps_page_size() {
    let app = spawn_app().await;

    app.create_user(ticketing_system::auth::types::UserRole::Employee).await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list?page_size=1", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(json["items"].as_array().unwrap().len() > 1);
}

#[tokio::test]
async fn get_users_with_search_by_name_returns_only_1_user() {
    let app = spawn_app().await;

    for _ in 0..3 {
        app.create_user(ticketing_system::auth::types::UserRole::Employee).await;
    }

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/user/list?q=admin", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json["items"].as_array().unwrap().len(), 1);
}