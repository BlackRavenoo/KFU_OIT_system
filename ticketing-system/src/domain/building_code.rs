use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct BuildingCode(#[garde(length(max = 6))] String);

impl AsRef<str> for BuildingCode {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for BuildingCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use garde::Validate;
    use super::BuildingCode;

    #[test]
    fn long_building_code_is_rejected() {
        let name = "a".repeat(7).to_string();
        assert_err!(BuildingCode(name).validate());
    }

    #[test]
    fn correct_building_code_is_valid() {
        let name = "a".repeat(6).to_string();
        assert_ok!(BuildingCode(name).validate());
    }
}