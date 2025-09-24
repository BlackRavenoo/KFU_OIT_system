use anyhow::Context;
use image::{DynamicImage, ImageReader};
use std::io::Cursor;

use crate::image::{ImageProcessor, ProcessingError};

pub struct WebpProcessor;

impl WebpProcessor {
    fn encode_webp(img: &DynamicImage) -> Result<Vec<u8>, ProcessingError> {
        let encoder = match webp::Encoder::from_image(img) {
            Ok(encoder) => encoder,
            Err(_) => return Err(ProcessingError::Unimplemented),
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
            .context("Failed to create image reader")?
            .decode()?;

        Ok((Self::encode_webp(&img)?, ".webp"))
    }
}