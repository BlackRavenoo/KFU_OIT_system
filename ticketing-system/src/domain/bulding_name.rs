use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Deserialize, Validate)]
pub struct BuildingName(#[garde(length(max = 255))] String);

string_newtype!(BuildingName);

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