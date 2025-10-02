use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Login(String);

impl Login {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.len() < 4 {
            return Err("String length must be at least 4 characters".to_string());
        }

        if s.len() > 64 {
            return Err("String length exceeds 64 characters".to_string());
        }

        if !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err("String contains invalid characters. Only ASCII letters, digits, and '_' are allowed".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for Login {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Login {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for Login {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};

    use super::*;

    #[test]
    fn empty_string_is_rejected() {
        let name = "".to_string();
        assert_err!(Login::parse(name));
    }

    #[test]
    fn a_64_char_long_login_is_valid() {
        let name = "a".repeat(64);
        assert_ok!(Login::parse(name));
    }

    #[test]
    fn a_65_char_long_login_is_rejected() {
        let name = "a".repeat(65);
        assert_err!(Login::parse(name));
    }

    #[test]
    fn login_with_wrong_characters_is_rejected() {
        let name = "Олег".to_string();
        assert_err!(Login::parse(name));
    }
}