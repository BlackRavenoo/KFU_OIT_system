use num_enum::FromPrimitive;
use serde::{Deserialize, Serialize};
use strum::EnumIter;

pub type NotificationId = i32;

#[derive(Deserialize, Serialize, Clone, Copy, EnumIter, Default, FromPrimitive, Debug)]
#[serde(from = "i16")]
#[repr(i16)]
pub enum SystemNotificationCategory {
    #[default]
    Info = 0,
    Warning = 1,
}
