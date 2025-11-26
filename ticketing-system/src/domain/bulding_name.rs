use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct BuildingName(String);

impl BuildingName {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.chars().count() > 255 {
            return Err("String length exceeds 255 characters".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for BuildingName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for BuildingName {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
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
    use super::BuildingName;

    #[test]
    fn long_building_name_is_rejected() {
        let name = "a".repeat(256).to_string();
        assert_err!(BuildingName::parse(name));
    }

    #[test]
    fn correct_building_name_is_valid() {
        let name = "a".repeat(255).to_string();
        assert_ok!(BuildingName::parse(name));
    }
}