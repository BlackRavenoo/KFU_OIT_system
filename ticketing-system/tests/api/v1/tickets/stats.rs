use crate::helpers::spawn_app;

#[tokio::test]
async fn get_stats_returns_200() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/stats", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_stats_returns_data() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/stats", app.address))
        .send()
        .await
        .unwrap();

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

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/stats", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}