use sqlx::PgPool;

use crate::helpers::spawn_app;

async fn insert_random_tickets(pool: &PgPool) {
    sqlx::query!(
        r#"
            INSERT INTO tickets(building_id, title, author, author_contacts, description)
            SELECT
                TRUNC(RANDOM() * 9) + 1,
                md5(random()::text),
                array_to_string(ARRAY(
                    SELECT chr(1040 + floor(random() * 33)::int) 
                    FROM generate_series(1, 5 + floor(random() * 10)::int)
                ), ''),
                FLOOR(random() * 9999999999)::text,
                md5(random()::text)
            FROM generate_series(1, 100)
        "#
    )
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn get_tickets_without_filters_returns_200() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 200);
}

#[tokio::test]
async fn get_tickets_with_invalid_page_returns_400() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/?page=-2", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn get_tickets_with_db_err_returns_500() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    sqlx::query!("
        DROP TABLE tickets CASCADE
    ")
    .execute(&app.db_pool)
    .await
    .unwrap();

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    assert_eq!(resp.status(), 500);
}

#[tokio::test]
async fn get_tickets_returns_tickets() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    insert_random_tickets(&app.db_pool).await;

    let resp = reqwest::Client::new()
        .get(format!("{}/v1/tickets/", app.address))
        .bearer_auth(access)
        .send()
        .await
        .unwrap();

    let json: serde_json::Value = resp.json().await.unwrap();

    let data = json["items"].as_array().unwrap();

    assert!(!data.is_empty());
}

#[tokio::test]
async fn get_tickets_returns_correct_items_count() {
    let app = spawn_app().await;

    let (access, _) = app.get_admin_jwt_tokens().await;

    insert_random_tickets(&app.db_pool).await;

    for size in vec![10, 25, 40, 50] {
        let resp = reqwest::Client::new()
            .get(format!("{}/v1/tickets/?page_size={}", app.address, size))
            .bearer_auth(&access)
            .send()
            .await
            .unwrap();
    
        let json: serde_json::Value = resp.json().await.unwrap();
    
        let data = json["items"].as_array().unwrap();
    
        assert_eq!(data.len(), size);
    }

}