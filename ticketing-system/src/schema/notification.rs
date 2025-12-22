use num_enum::FromPrimitive;
use serde::Deserialize;
use strum::EnumIter;

#[derive(Deserialize, Clone, Copy, EnumIter, Default, FromPrimitive, Debug)]
#[serde(from = "i16")]
#[repr(i16)]
pub enum SystemNotificationCategory {
    #[default]
    Info,
    Warning,
}