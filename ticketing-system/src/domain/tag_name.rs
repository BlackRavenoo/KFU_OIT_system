use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct TagName(String);

impl TagName {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.chars().count() < 3 {
            return Err("String length must be at least 3 characters".to_string());
        }

        if s.chars().count() > 32 {
            return Err("String length exceeds 32 characters".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for TagName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for TagName {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for TagName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use super::TagName;

    #[test]
    fn short_tag_name_is_rejected() {
        let name = "aa".to_string();
        assert_err!(TagName::parse(name));
    }

    #[test]
    fn long_tag_name_is_rejected() {
        let name = "a".repeat(33).to_string();
        assert_err!(TagName::parse(name));
    }

    #[test]
    fn correct_tag_name_is_valid() {
        let name = "a".repeat(32).to_string();
        assert_ok!(TagName::parse(name));
    }
}