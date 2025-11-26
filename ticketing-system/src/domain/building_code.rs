use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct BuildingCode(String);

impl BuildingCode {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.chars().count() > 6 {
            return Err("String length exceeds 6 characters".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for BuildingCode {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for BuildingCode {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
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
    use super::BuildingCode;

    #[test]
    fn long_building_code_is_rejected() {
        let name = "a".repeat(7).to_string();
        assert_err!(BuildingCode::parse(name));
    }

    #[test]
    fn correct_building_code_is_valid() {
        let name = "a".repeat(6).to_string();
        assert_ok!(BuildingCode::parse(name));
    }
}