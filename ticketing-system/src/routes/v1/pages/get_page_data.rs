use actix_web::{HttpResponse, ResponseError, http::header, web};
use anyhow::Context;

use crate::{services::pages::{PageService, PageType}, storage::FileAccess, utils::error_chain_fmt};



#[derive(thiserror::Error)]
pub enum GetPageDataError {
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error)
}

impl std::fmt::Debug for GetPageDataError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        error_chain_fmt(self, f)
    }
}

impl ResponseError for GetPageDataError {}

pub async fn get_page_data(
    path: web::Path<(String, String)>,
    page_service: web::Data<PageService>,
) -> Result<HttpResponse, GetPageDataError> {
    let (prefix, key) = path.into_inner();

    let page_type = PageType::try_from(prefix)?;
        
    let page = page_service.get_page(&key, page_type.is_public()).await
        .context("Failed to get page")?;

    match page {
        FileAccess::ExternalUrl(url) => Ok(HttpResponse::MovedPermanently()
        .append_header((header::LOCATION, url))
        .finish()),
        FileAccess::Stream(stream) => Ok(HttpResponse::Ok().streaming(stream)),
    }
}