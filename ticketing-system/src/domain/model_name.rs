use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Validate, Deserialize)]
pub struct ModelName(#[garde(length(graphemes, max = 128))] String);

string_newtype!(ModelName);

#[cfg(test)]
mod tests {
    use super::ModelName;
    use claims::{assert_err, assert_ok};
    use garde::Validate as _;

    #[test]
    fn a_128_grapheme_long_name_is_valid() {
        let name = "а".repeat(128);
        assert_ok!(ModelName(name).validate());
    }

    #[test]
    fn a_129_grapheme_long_name_is_rejected() {
        let name = "а".repeat(129);
        assert_err!(ModelName(name).validate());
    }
}