use serde::Deserialize;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Description(String);

impl Description {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.graphemes(true).count() > 1024 {
            return Err("Description cannot be longer than 1024 characters".to_string());
        }
        
        if s.trim().is_empty() {
            return Err("Description cannot be empty".to_string());
        }
        
        Ok(Description(s))
    }
}

impl AsRef<str> for Description {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Description {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

#[cfg(test)]
mod tests {
    use super::Description;
    use claim::{assert_err, assert_ok};

    #[test]
    fn empty_string_is_rejected() {
        let name = "".to_string();
        assert_err!(Description::parse(name));
    }

    #[test]
    fn a_1024_grapheme_long_name_is_valid() {
        let name = "а".repeat(1024);
        assert_ok!(Description::parse(name));
    }

    #[test]
    fn a_1025_grapheme_long_name_is_rejected() {
        let name = "а".repeat(1025);
        assert_err!(Description::parse(name));
    }
}