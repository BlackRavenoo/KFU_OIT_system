use crate::helpers::spawn_app;

#[tokio::test]
async fn get_metrics_without_token_returns_401() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/metrics", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn get_metrics_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let ticket_resp = app.create_test_ticket().await;
    assert_eq!(ticket_resp.status(), 201);

    let ticket_json: serde_json::Value = ticket_resp.json().await.unwrap();
    let ticket_id = ticket_json["id"].as_i64().unwrap();

    sqlx::query!(
        "UPDATE tickets
        SET
            first_response_at = created_at + INTERVAL '10 minutes',
            closed_at = created_at + INTERVAL '80 minutes',
            status = 1
        WHERE id = $1",
        ticket_id
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/metrics", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let json: serde_json::Value = resp.json().await.unwrap();
    let items = json.as_array().unwrap();

    assert!(!items.is_empty());

    let first = &items[0];
    assert!(first.get("month").is_some());
    assert!(first.get("total").is_some());
    assert!(first.get("closed").is_some());
    assert!(first.get("avg_frt").is_some());
    assert!(first.get("avg_mttr").is_some());
    assert!(first.get("sla_breaches").is_some());
}

#[tokio::test]
async fn get_metrics_with_invalid_filter_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/metrics?building_id=0", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}
