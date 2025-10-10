use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::{spawn_app, TestApp};

async fn get_image(app: &TestApp, data: Option<&[u8]>, status: u16) -> reqwest::Response {
    let mut template = ResponseTemplate::new(status);

    if let Some(data) = data {
        template = template.set_body_bytes(data);
    }
    
    let _mock_guard = Mock::given(path("/test-bucket/attachments/test.png"))
        .and(method("GET"))
        .respond_with(template)
        .expect(1)
        .mount_as_scoped(&app.s3_server)
        .await;

    reqwest::get(format!("{}/v1/images/attachments/test.png", app.address))
        .await
        .unwrap()
}

#[tokio::test]
pub async fn get_image_returns_200() {
    let app = spawn_app().await;

    let resp = get_image(&app, None, 200).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
pub async fn get_image_returns_data() {
    let app = spawn_app().await;

    let data = vec![3, 5, 4, 6];

    let resp = get_image(
        &app,
        Some(&data),
        200
    ).await;

    assert_eq!(resp.bytes().await.unwrap(), data);
}