use actix_web::{HttpResponse, ResponseError, http::header, web};
use anyhow::Context;

use crate::{auth::{extractor::user_role::OptionalUserRoleExtractor, types::UserRole}, services::pages::{PageService, PageType}, storage::FileAccess, utils::error_chain_fmt};



#[derive(thiserror::Error)]
pub enum GetPageDataError {
    #[error("Insufficient permissions to get page data")]
    InsufficientPermissions,
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
    role: OptionalUserRoleExtractor,
) -> Result<HttpResponse, GetPageDataError> {
    let (prefix, key) = path.into_inner();

    let page_type = PageType::try_from(prefix)?;
    
    let is_public = page_type.is_public();

    if !is_public {
        match role.0 {
            Some(role) => if !role.has_access(UserRole::Employee) {
                return Err(GetPageDataError::InsufficientPermissions)
            },
            None => return Err(GetPageDataError::InsufficientPermissions),
        }
    }

    let page = page_service.get_page(&key, is_public).await
        .context("Failed to get page")?;

    match page {
        FileAccess::ExternalUrl(url) => Ok(HttpResponse::MovedPermanently()
            .append_header((header::LOCATION, url))
            .finish()),
        FileAccess::Stream(stream) => Ok(HttpResponse::Ok().streaming(stream)),
    }
}