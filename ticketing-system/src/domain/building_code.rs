use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Deserialize, Validate)]
pub struct BuildingCode(#[garde(length(max = 6))] String);

string_newtype!(BuildingCode);

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