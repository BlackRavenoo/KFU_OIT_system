use chrono::{Duration, Utc};

use crate::helpers::spawn_app;

#[tokio::test]
async fn generate_statistics_report_without_token_returns_401() {
    let app = spawn_app().await;

    let payload = serde_json::json!({
        "from_date": (Utc::now() - Duration::days(7)),
        "to_date": Utc::now()
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/reports/tickets/statistics", app.address))
        .json(&payload)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn generate_statistics_report_for_client_returns_403() {
    let app = spawn_app().await;

    let login = app
        .create_user(ticketing_system::auth::types::UserRole::Client)
        .await;

    let (access, _) = app.get_jwt_tokens(&login, "admin").await;

    let payload = serde_json::json!({
        "from_date": (Utc::now() - Duration::days(7)),
        "to_date": Utc::now()
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/reports/tickets/statistics", app.address))
        .bearer_auth(access)
        .json(&payload)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn generate_statistics_report_returns_xlsx_for_employee() {
    let app = spawn_app().await;

    let login = app
        .create_user(ticketing_system::auth::types::UserRole::Employee)
        .await;
    
    let (access, _) = app.get_jwt_tokens(&login, "admin").await;

    let ticket_resp = app.create_test_ticket().await;
    assert_eq!(ticket_resp.status(), 201);

    let payload = serde_json::json!({
        "from_date": (Utc::now() - Duration::days(30)),
        "to_date": (Utc::now() + Duration::days(1))
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/reports/tickets/statistics", app.address))
        .bearer_auth(access)
        .json(&payload)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);

    let content_type = resp
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();

    assert!(content_type.starts_with("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

    let body = resp.bytes().await.unwrap();
    assert!(body.starts_with(b"PK"));
}

#[tokio::test]
async fn generate_statistics_report_with_invalid_range_returns_400() {
    let app = spawn_app().await;

    let login = app
        .create_user(ticketing_system::auth::types::UserRole::Employee)
        .await;

    let (access, _) = app.get_jwt_tokens(&login, "admin").await;

    let payload = serde_json::json!({
        "from_date": Utc::now(),
        "to_date": (Utc::now() - Duration::days(1))
    });

    let resp = reqwest::Client::new()
        .post(format!("{}/v1/reports/tickets/statistics", app.address))
        .bearer_auth(access)
        .json(&payload)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}
