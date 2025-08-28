use serde::{Deserialize, Serialize};

pub type UserId = i32;

#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    #[default]
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

#[derive(Serialize)]
pub struct PaginationMeta {
    pub max_page: u64,
    pub total_items: u64,
}

#[derive(Serialize)]
pub struct PaginationResult<T> {
    #[serde(flatten)]
    pub meta: PaginationMeta,
    pub items: Vec<T>
}

impl<T> PaginationResult<T> {
    pub fn new(meta: PaginationMeta, items: Vec<T>) -> Self {
        Self { meta, items }
    }
    
    pub fn new_with_pagination(total_items: u64, page_size: i8, items: Vec<T>) -> Self {
        let page_size = page_size as u64;
        
        let max_page = if total_items == 0 {
            1
        } else {
            total_items.div_ceil(page_size)
        };

        Self {
            meta: PaginationMeta { max_page, total_items },
            items,
        }
    }
}