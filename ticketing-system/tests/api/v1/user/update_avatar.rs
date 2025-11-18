use wiremock::{matchers::{method, path_regex}, Mock, ResponseTemplate};

use crate::helpers::spawn_app;

#[tokio::test]
async fn update_avatar_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path_regex(r"/test-bucket/avatars/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let resp = app.update_avatar(
        Some(&access),
        include_bytes!("../../../../../www/static/KFU.png").into()
    ).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_avatar_without_token_returns_401() {
    let app = spawn_app().await;

    Mock::given(path_regex(r"/test-bucket/avatars/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let resp = app.update_avatar(
        None,
        include_bytes!("../../../../../www/static/KFU.png").into()
    ).await;

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn update_avatar_with_invalid_image_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    Mock::given(path_regex(r"/test-bucket/avatars/.*\.webp"))
        .and(method("PUT"))
        .respond_with(ResponseTemplate::new(200))
        .expect(0)
        .mount(&app.s3_server)
        .await;

    let resp = app.update_avatar(
        Some(&access),
        vec![]
    ).await;

    assert_eq!(resp.status(), 500);
}