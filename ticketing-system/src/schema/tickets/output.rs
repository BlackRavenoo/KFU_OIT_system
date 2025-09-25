use serde::Serialize;

use crate::schema::common::UserId;

#[derive(Serialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
}

pub fn create_assigned_users(names: Option<Vec<String>>, ids: Option<Vec<UserId>>) -> Option<Vec<User>> {
    if let (Some(names), Some(ids)) = (names, ids) {
        Some(
            names.into_iter()
                .zip(ids)
                .map(|(name, id)| User {
                    id,
                    name,
                })
                .collect()
        )
    } else {
        None
    }
}

#[derive(Serialize)]
pub struct Building {
    pub id: i16,
    pub code: String,
    pub name: String,
}