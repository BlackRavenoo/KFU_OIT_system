use wiremock::{matchers::{method, path}, Mock, ResponseTemplate};

use crate::helpers::spawn_app;

#[tokio::test]
pub async fn get_page_data_returns_200() {
    let app = spawn_app().await;

    Mock::given(path("/test-bucket/pages/test.json"))
        .and(method("GET"))
        .respond_with(ResponseTemplate::new(200))
        .expect(1)
        .mount(&app.s3_server)
        .await;

    let resp = reqwest::get(format!("{}/v1/page/public/test.json", app.address))
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}