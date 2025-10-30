use crate::helpers::{TestApp, spawn_app};

async fn search_tags(app: &TestApp, body: &serde_json::Value) -> reqwest::Response {
    reqwest::Client::new()
        .get(format!(
            "{}/v1/tags/?{}",
            app.address,
            serde_qs::to_string(body).unwrap()
        ))
        .send()
        .await
        .unwrap()
}

async fn create_test_tag(app: &TestApp) {
    let (access, _) = app.get_admin_jwt_tokens().await;

    let json = serde_json::json!({
        "name": "Test tag",
        "synonyms": []
    });

    app.create_tag(&json, Some(&access)).await;
}

#[tokio::test]
async fn search_tags_returns_200() {
    let app = spawn_app().await;

    let body = serde_json::json!({
        "q": "Test"
    });

    let resp = search_tags(&app, &body).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn search_tags_returns_tags() {
    let app = spawn_app().await;

    create_test_tag(&app).await;

    let body = serde_json::json!({
        "q": "Test"
    });

    let resp = search_tags(&app, &body).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    let json = json.as_array()
        .unwrap()
        .first()
        .unwrap();

    assert!(
        json.get("id").is_some()
        && json.get("name").is_some()
    );
}