use serde::Deserialize;

#[derive(Deserialize)]
pub enum SortOrder {
    Asc,
    Desc
}

impl SortOrder {
    pub fn as_str(&self) -> &'static str {
        match self {
            SortOrder::Asc => "ASC",
            SortOrder::Desc => "DESC",
        }
    }
}