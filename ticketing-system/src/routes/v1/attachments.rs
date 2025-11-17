use actix_web::{http::header, web, HttpResponse, Responder};

use crate::{services::attachment::{AttachmentService, AttachmentType}, storage::FileAccess};

pub async fn get_attachment(
    path: web::Path<(String, String)>,
    service: web::Data<AttachmentService>
) -> impl Responder {
    let (prefix, key) = path.into_inner();

    let attachment_type = match AttachmentType::try_from(prefix) {
        Ok(image_type) => image_type,
        Err(e) => {
            tracing::error!("Failed to get image type from string: {}", e);
            return HttpResponse::BadRequest().finish()
        },
    };

    match service.get(attachment_type, &key).await {
        Ok(file_access) => match file_access {
            FileAccess::ExternalUrl(url) => HttpResponse::MovedPermanently()
                .append_header((header::LOCATION, url))
                .finish(),
            FileAccess::Stream(stream) => HttpResponse::Ok().streaming(stream),
        },
        Err(e) => {
            tracing::error!("Failed to get image access: {:?}", e);
            HttpResponse::InternalServerError().finish()
        },
    }
}