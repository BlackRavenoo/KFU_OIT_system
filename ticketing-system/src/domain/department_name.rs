use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct DepartmentName(#[garde(length(max = 80))] String);

impl AsRef<str> for DepartmentName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use claims::{assert_err, assert_ok};
    use garde::Validate;
    use super::DepartmentName;

    #[test]
    fn long_department_name_is_rejected() {
        let name = "a".repeat(81).to_string();
        assert_err!(DepartmentName(name).validate());
    }

    #[test]
    fn correct_department_name_is_valid() {
        let name = "a".repeat(80).to_string();
        assert_ok!(DepartmentName(name).validate());
    }
}