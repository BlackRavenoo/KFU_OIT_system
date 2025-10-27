use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Title(String);

impl Title {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.chars().count() < 4 {
            return Err("String length must be at least 4 characters".to_string());
        }

        if s.chars().count() > 64 {
            return Err("String length exceeds 64 characters".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for Title {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Title {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for Title {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::Title;
    use claims::{assert_err, assert_ok};

    #[test]
    fn empty_string_is_rejected() {
        let name = "".to_string();
        assert_err!(Title::parse(name));
    }

    #[test]
    fn a_3_char_long_name_is_rejected() {
        let name = "a".repeat(3);
        assert_err!(Title::parse(name));
    }

    #[test]
    fn a_64_char_long_name_is_valid() {
        let name = "a".repeat(64);
        assert_ok!(Title::parse(name));
    }

    #[test]
    fn a_65_char_long_name_is_rejected() {
        let name = "a".repeat(65);
        assert_err!(Title::parse(name));
    }
}