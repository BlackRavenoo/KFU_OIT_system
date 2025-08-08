use image::{DynamicImage, ImageError, ImageReader};
use std::io::Cursor;

use crate::image::{ImageProcessor, ProcessingError};

pub struct WebpProcessor;

impl From<ImageError> for ProcessingError {
    fn from(value: ImageError) -> Self {
        Self::ImageError(value)
    }
}

impl WebpProcessor {
    fn encode_webp(img: &DynamicImage) -> Result<Vec<u8>, ProcessingError> {
        let encoder = match webp::Encoder::from_image(img) {
            Ok(encoder) => encoder,
            Err(e) => return Err(ProcessingError::Other(e.to_string())),
        };

        let webp_data = encoder.encode(90.0);

        Ok(webp_data.to_owned())
    }
}

impl ImageProcessor for WebpProcessor {
    fn process(data: &[u8]) -> Result<(Vec<u8>, &'static str), ProcessingError> {
        if data.is_empty() {
            return Err(ProcessingError::EmptyInput);
        }

        let img = ImageReader::new(Cursor::new(data))
            .with_guessed_format()
            .map_err(|e| ProcessingError::UnsupportedImageFormat(e.to_string()))?
            .decode()?;

        Ok((Self::encode_webp(&img)?, ".webp"))
    }
}