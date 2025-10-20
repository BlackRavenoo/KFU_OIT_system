use actix_web::{http::StatusCode, ResponseError};
use image::ImageError;
use thiserror::Error;

pub mod webp;
pub mod thumbnail;

#[derive(Error, Debug)]
pub enum ProcessingError {
    #[error("Failed to process image: {0}")]
    ImageError(#[from] ImageError),
    #[error("Empty input")]
    EmptyInput,
    #[error("Unimplemented")]
    Unimplemented,
    #[error("Something went wrong: {0}")]
    Other(#[from] anyhow::Error),
}

impl ResponseError for ProcessingError {
    fn status_code(&self) -> StatusCode {
        match self {
            ProcessingError::EmptyInput | ProcessingError::ImageError(_) => StatusCode::BAD_REQUEST,
            ProcessingError::Unimplemented | ProcessingError::Other(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

pub trait ImageProcessor {
    // Returns image data + extension(".webp", ".jpg")
    fn process(data: &[u8]) -> Result<(Vec<u8>, &'static str), ProcessingError>;
}