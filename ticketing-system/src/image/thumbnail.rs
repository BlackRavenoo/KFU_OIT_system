use std::io::Cursor;

use anyhow::Context as _;
use image::ImageReader;

use crate::image::{webp::WebpProcessor, ImageProcessor, ProcessingError};

pub struct AvatarProcessor;

impl ImageProcessor for AvatarProcessor {
    fn process(data: &[u8]) -> Result<(Vec<u8>, &'static str), ProcessingError> {
        if data.is_empty() {
            return Err(ProcessingError::EmptyInput);
        }

        let img = ImageReader::new(Cursor::new(data))
            .with_guessed_format()
            .context("Failed to create image reader")?
            .decode()?;

        let (width, height) = (img.width(), img.height());
        let size = width.min(height);
        let x = (width - size) / 2;
        let y = (height - size) / 2;
        let cropped = img.crop_imm(x, y, size, size);
        
        let resized = cropped.resize(256, 256, image::imageops::FilterType::Lanczos3);

        Ok((WebpProcessor::encode_webp(&resized)?, ".webp"))
    }
}