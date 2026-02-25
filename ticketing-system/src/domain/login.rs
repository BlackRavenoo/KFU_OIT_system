use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct Login(
    #[garde(
        length(bytes, min = 4, max = 64),
        pattern(r"^[a-zA-Z0-9_]+$")
    )]
    String
);

impl AsRef<str> for Login {
    fn as_ref(&self) -> &str {
        &self.0
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
        assert_err!(Login(name).validate());
    }

    #[test]
    fn a_64_char_long_login_is_valid() {
        let name = "a".repeat(64);
        assert_ok!(Login(name).validate());
    }

    #[test]
    fn a_65_char_long_login_is_rejected() {
        let name = "a".repeat(65);
        assert_err!(Login(name).validate());
    }

    #[test]
    fn login_with_wrong_characters_is_rejected() {
        let name = "Олег".to_string();
        assert_err!(Login(name).validate());
    }
}