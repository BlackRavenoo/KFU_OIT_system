use bytes::Bytes;

use crate::services::attachment::service::AttachmentServiceError;

#[derive(Debug, Clone)]
pub enum AttachmentType {
    TicketAttachments,
    Avatars,
}

impl AttachmentType {
    pub fn prefix(&self) -> &'static str {
        match self {
            AttachmentType::TicketAttachments => "attachments",
            AttachmentType::Avatars => "avatars",
        }
    }
}

impl TryFrom<String> for AttachmentType {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "attachments" => Ok(AttachmentType::TicketAttachments),
            "avatars" => Ok(AttachmentType::Avatars),
            _ => Err(format!("Unknown image type: {}", value)),
        }
    }
}

impl TryFrom<&str> for AttachmentType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "attachments" => Ok(AttachmentType::TicketAttachments),
            "avatars" => Ok(AttachmentType::Avatars),
            _ => Err(format!("Unknown image type: {}", value)),
        }
    }
}

pub struct Attachment {
    pub data: Bytes,
    pub extension: String,
}

impl Attachment {
    const ALLOWED_EXTENSIONS: [&'static str; 10] = [
        "jpg", "jpeg", "png", "webp",
        "doc", "docx", "ppt", "pptx", "txt", "pdf"
    ];

    pub fn is_image(&self) -> bool {
        matches!(self.extension.as_str(), "jpg" | "jpeg" | "png" | "webp")
    }
}

impl TryFrom<actix_multipart::form::bytes::Bytes> for Attachment {
    type Error = AttachmentServiceError;

    fn try_from(value: actix_multipart::form::bytes::Bytes) -> Result<Self, Self::Error> {
        let file_name = value.file_name
            .ok_or_else(|| AttachmentServiceError::UnsupportedFormat)?;
        
        let extension = std::path::Path::new(file_name.as_str())
            .extension()
            .and_then(|e| e.to_str())
            .ok_or(AttachmentServiceError::UnsupportedFormat)?
            .to_lowercase();

        if !Self::ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
            return Err(AttachmentServiceError::UnsupportedFormat);
        }

        Ok(Self {
            data: value.data,
            extension
        })
    }
}