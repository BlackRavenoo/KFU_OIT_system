use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct DepartmentName(String);

impl DepartmentName {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.chars().count() > 80 {
            return Err("String length exceeds 80 characters".to_string());
        }

        Ok(Self(s))
    }
}

impl AsRef<str> for DepartmentName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for DepartmentName {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for DepartmentName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use super::DepartmentName;

    #[test]
    fn long_department_name_is_rejected() {
        let name = "a".repeat(81).to_string();
        assert_err!(DepartmentName::parse(name));
    }

    #[test]
    fn correct_department_name_is_valid() {
        let name = "a".repeat(80).to_string();
        assert_ok!(DepartmentName::parse(name));
    }
}