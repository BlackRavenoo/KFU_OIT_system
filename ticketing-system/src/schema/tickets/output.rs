use serde::Serialize;

#[derive(Serialize)]
pub struct Building {
    pub id: i16,
    pub code: String,
    pub name: String,
}