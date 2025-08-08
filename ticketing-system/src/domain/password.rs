use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Password(String);

impl Password {
    pub fn parse(s: String) -> Result<Self, String> {
        let is_valid_length = s.len() >= 8 && s.len() <= 64;
        
        let has_letter = s.chars().any(|c| c.is_ascii_alphabetic());
        let has_digit = s.chars().any(|c| c.is_ascii_digit());
        let is_ascii_only = s.is_ascii();
        
        let has_required_chars = has_letter && has_digit && is_ascii_only;

        if is_valid_length && has_required_chars {
            Ok(Password(s))
        } else {
            Err("Password must be 8-64 characters long and contain at least one letter and one digit".to_string())
        }
    }
}

impl AsRef<str> for Password {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Password {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}