pub mod service;
pub mod attachment;

pub use service::{AttachmentService, AttachmentServiceError};
pub use attachment::{AttachmentType, Attachment};