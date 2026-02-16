use crate::helpers::spawn_app;

#[tokio::test]
async fn get_page_returns_200() {
    let app = spawn_app().await;

    app.create_test_page().await;

    let resp = app.get_page(1, None).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_private_page_without_token_returns_404() {
    let app = spawn_app().await;

    app.create_private_page().await;

    let resp = app.get_page(1, None).await;

    assert_eq!(resp.status(), 404);
}

#[tokio::test]
async fn get_private_page_for_client_returns_404() {
    let app = spawn_app().await;

    app.create_private_page().await;

    let login = app.create_user(ticketing_system::auth::types::UserRole::Client).await;

    let (access, _) = app.get_jwt_tokens(&login, "admin").await;

    let resp = app.get_page(1, Some(&access)).await;

    assert_eq!(resp.status(), 404);
}

#[tokio::test]
async fn get_page_with_db_err_returns_500() {
    let app = spawn_app().await;

    app.create_test_page().await;

    sqlx::query!("DROP TABLE pages CASCADE")
        .execute(&app.db_pool)
        .await
        .unwrap();

    let resp = app.get_page(1, None).await;

    assert_eq!(resp.status(), 500);
}