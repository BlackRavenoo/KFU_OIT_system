use crate::helpers::spawn_app;

#[tokio::test]
async fn get_consts_returns_200() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/consts", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_consts_returns_data() {
    let app = spawn_app().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/consts", app.address))
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    assert!(
        json.get("order_by").is_some()
        && json.get("buildings").is_some()
    );
}

#[tokio::test]
async fn get_consts_with_db_err_returns_500() {
    let app = spawn_app().await;

    sqlx::query!(
        "DROP TABLE buildings CASCADE"
    )
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/consts", app.address))
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}