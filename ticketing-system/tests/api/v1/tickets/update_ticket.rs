use crate::helpers::spawn_app;

#[tokio::test]
async fn update_ticket_returns_200() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .json(&serde_json::json!({
            "title": "Some title for tests"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn update_ticket_changes_field_value() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let title = "Some title for tests";

    reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .json(&serde_json::json!({
            "title": title
        }))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let ticket = app.get_ticket(1).await
        .error_for_status()
        .unwrap();

    let json: serde_json::Value = ticket.json().await.unwrap();

    assert_eq!(json["title"].as_str(), Some(title));
}

#[tokio::test]
async fn update_ticket_without_json_returns_400() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_ticket_without_fields_returns_400() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .json(&serde_json::json!({}))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_ticket_updates_all_fields() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let json = serde_json::json!({
        "title": "Some title for tests",
        "description": "Some description for tests",
        "author": "Some author for tests",
        "author_contacts": "5555555555",
        "status": "open",
        "priority": "high",
        "cabinet": "101A",
        "note": "This is a test note",
        "building_id": 1
    });

    reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .json(&json)
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    let resp = app.get_ticket(1).await;

    let data: serde_json::Value = resp.json().await.unwrap();

    assert!(
        data["title"] == json["title"]
        && data["description"] == json["description"]
        && data["author"] == json["author"]
        && data["author_contacts"] == json["author_contacts"]
        && data["status"] == json["status"]
        && data["priority"] == json["priority"]
        && data["cabinet"] == json["cabinet"]
        && data["note"] == json["note"]
        && data["building"]["id"] == json["building_id"]
    );
}

#[tokio::test]
async fn update_ticket_with_separate_requests_updates_all_fields() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    let json = serde_json::json!({
        "title": "Some title for tests",
        "description": "Some description for tests",
        "author": "Some author for tests",
        "author_contacts": "5555555555",
        "status": "open",
        "priority": "high",
        "cabinet": "101A",
        "note": "This is a test note",
        "building_id": 1
    });

    for (key, value) in json.as_object().unwrap().iter() {
        reqwest::Client::new()
            .put(format!("{}/v1/tickets/1", app.address))
            .bearer_auth(&access)
            .json(&serde_json::json!({
                key: value
            }))
            .send()
            .await
            .unwrap()
            .error_for_status()
            .unwrap();
    }

    let resp = app.get_ticket(1).await;

    let data: serde_json::Value = resp.json().await.unwrap();

    assert!(
        data["title"] == json["title"]
        && data["description"] == json["description"]
        && data["author"] == json["author"]
        && data["author_contacts"] == json["author_contacts"]
        && data["status"] == json["status"]
        && data["priority"] == json["priority"]
        && data["cabinet"] == json["cabinet"]
        && data["note"] == json["note"]
        && data["building"]["id"] == json["building_id"]
    );
}

#[tokio::test]
async fn update_ticket_with_db_error_returns_500() {
    let app = spawn_app().await;

    app.create_test_ticket().await
        .error_for_status()
        .unwrap();

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!(
        "DROP TABLE tickets CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .put(format!("{}/v1/tickets/1", app.address))
        .bearer_auth(access)
        .json(&serde_json::json!({
            "title": "Title"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}