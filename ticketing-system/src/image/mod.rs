use image::ImageError;
use thiserror::Error;

pub mod webp;

#[derive(Error, Debug)]
pub enum ProcessingError {
    #[error("Failed to process image: {0}")]
    ImageError(ImageError),
    #[error("Unsupported image format: {0}")]
    UnsupportedImageFormat(String),
    #[error("Empty input")]
    EmptyInput,
    #[error("Something went wrong: {0}")]
    Other(String)
}

pub trait ImageProcessor {
    fn process(data: &[u8]) -> Result<Vec<u8>, ProcessingError>;
}