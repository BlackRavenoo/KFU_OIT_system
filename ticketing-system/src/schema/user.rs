use serde::Serialize;

#[derive(Serialize)]
pub struct UserStats {
    pub active_tickets_count: i64,
    pub closed_tickets_count: i64,
    pub cancelled_tickets_count: i64,
}