use actix_web::{http::header, web, HttpResponse, Responder};

use crate::{services::image::{ImageService, ImageType}, storage::FileAccess};

pub async fn get_image(
    path: web::Path<(String, String)>,
    image_service: web::Data<ImageService>
) -> impl Responder {
    let (prefix, key) = path.into_inner();

    let image_type = match ImageType::try_from(prefix) {
        Ok(image_type) => image_type,
        Err(e) => {
            tracing::error!("Failed to get image type from string: {}", e);
            return HttpResponse::BadRequest().finish()
        },
    };

    match image_service.get_image(image_type, &key).await {
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