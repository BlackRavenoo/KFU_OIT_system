use crate::helpers::spawn_app;

#[tokio::test]
async fn update_page_updates_title_and_no_fields_is_ok() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let body = serde_json::json!({
        "data": {"text": "Some text"},
        "title": "Test title",
        "tags": [],
        "related": [],
        "is_public": true
    });

    let resp = app.create_page(&body, Some(&access)).await;
    let json: serde_json::Value = resp.json().await.unwrap();
    let page_id = json["id"].as_i64().unwrap() as i32;

    let update = serde_json::json!({
        "title": "Updated title",
        "tags_to_add": [],
        "tags_to_delete": [],
        "related_to_add": [],
        "related_to_delete": [],
    });

    let client = reqwest::Client::new();
    let upd = client
        .put(format!("{}/v1/pages/{}", app.address, page_id))
        .bearer_auth(&access)
        .json(&update)
        .send()
        .await
        .unwrap();

    assert_eq!(upd.status().as_u16(), 200);

    let title: String = sqlx::query_scalar!("SELECT title FROM pages WHERE id = $1", page_id)
        .fetch_one(&app.db_pool)
        .await
        .unwrap();

    assert_eq!(title, "Updated title");

    let empty_update = serde_json::json!({
        "tags_to_add": [],
        "tags_to_delete": [],
        "related_to_add": [],
        "related_to_delete": [],
    });

    let resp2 = client
        .put(format!("{}/v1/pages/{}", app.address, page_id))
        .bearer_auth(&access)
        .json(&empty_update)
        .send()
        .await
        .unwrap();

    assert_eq!(resp2.status().as_u16(), 200);
}
