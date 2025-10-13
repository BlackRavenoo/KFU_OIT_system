use crate::helpers::{spawn_app, TestApp};

async fn get_stats(app: &TestApp) -> reqwest::Response {
    reqwest::Client::new()
        .get(format!("{}/v1/tickets/stats", app.address))
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn get_stats_returns_200() {
    let app = spawn_app().await;

    let resp = get_stats(&app).await;

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_stats_returns_data() {
    let app = spawn_app().await;

    let resp = get_stats(&app).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("daily_tickets").is_some()
        && json.get("tickets_count").is_some()
        && json.get("percent_of_closed").is_some()
    );
}

#[tokio::test]
async fn get_stats_with_db_err_returns_500() {
    let app = spawn_app().await;

    sqlx::query!(
        "DROP TABLE tickets CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = get_stats(&app).await;

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn get_stats_returns_correct_data() {
    let app = spawn_app().await;

    for _ in 0..10 {
        app.create_test_ticket().await;
    }

    let json = serde_json::json!({
        "status": "closed"
    });

    for id in 1..=7 {
        app.update_ticket(id, &json).await;
    }

    let resp = get_stats(&app).await;

    let json: serde_json::Value = resp.json().await.unwrap();

    assert_eq!(json["daily_tickets"].as_i64().unwrap(), 10);
    assert_eq!(json["tickets_count"].as_i64().unwrap(), 10);
    assert_eq!(json["percent_of_closed"].as_f64().unwrap(), 70.0);
}

#[tokio::test]
async fn get_stats_returns_same_data() {
    let app = spawn_app().await;

    let resp1 = get_stats(&app).await;

    for _ in 0..3 {
        app.create_test_ticket().await;
    }

    let resp2 = get_stats(&app).await;

    let json1: serde_json::Value = resp1.json().await.unwrap();

    let json2: serde_json::Value = resp2.json().await.unwrap();

    assert_eq!(json1, json2);
}