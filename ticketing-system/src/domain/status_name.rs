use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Validate, Deserialize)]
pub struct StatusName(#[garde(length(graphemes, max = 32))] String);

string_newtype!(StatusName);

#[cfg(test)]
mod tests {
    use super::StatusName;
    use claims::{assert_err, assert_ok};
    use garde::Validate as _;

    #[test]
    fn a_32_grapheme_long_name_is_valid() {
        let name = "а".repeat(32);
        assert_ok!(StatusName(name).validate());
    }

    #[test]
    fn a_33_grapheme_long_name_is_rejected() {
        let name = "а".repeat(33);
        assert_err!(StatusName(name).validate());
    }
}