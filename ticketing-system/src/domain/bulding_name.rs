use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct BuildingName(#[garde(length(max = 255))] String);

impl AsRef<str> for BuildingName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for BuildingName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use garde::Validate;
    use super::BuildingName;

    #[test]
    fn long_building_name_is_rejected() {
        let name = "a".repeat(256).to_string();
        assert_err!(BuildingName(name).validate());
    }

    #[test]
    fn correct_building_name_is_valid() {
        let name = "a".repeat(255).to_string();
        assert_ok!(BuildingName(name).validate());
    }
}