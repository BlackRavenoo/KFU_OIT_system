use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Validate, Deserialize)]
pub struct TagName(#[garde(length(min = 3, max = 32))] String);

impl AsRef<str> for TagName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use garde::Validate;
    use super::TagName;

    #[test]
    fn short_tag_name_is_rejected() {
        let name = "aa".to_string();
        assert_err!(TagName(name).validate());
    }

    #[test]
    fn long_tag_name_is_rejected() {
        let name = "a".repeat(33).to_string();
        assert_err!(TagName(name).validate());
    }

    #[test]
    fn correct_tag_name_is_valid() {
        let name = "a".repeat(32).to_string();
        assert_ok!(TagName(name).validate());
    }
}