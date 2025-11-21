use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
pub struct Building {
    pub id: i16,
    pub code: String,
    pub name: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Department {
    pub id: i16,
    pub name: String,
}