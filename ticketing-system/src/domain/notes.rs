use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Validate, Deserialize)]
pub struct Notes(#[garde(length(graphemes, max = 512))] String);

string_newtype!(Notes);

#[cfg(test)]
mod tests {
    use super::Notes;
    use claims::{assert_err, assert_ok};
    use garde::Validate as _;

    #[test]
    fn a_512_grapheme_long_name_is_valid() {
        let name = "а".repeat(512);
        assert_ok!(Notes(name).validate());
    }

    #[test]
    fn a_513_grapheme_long_name_is_rejected() {
        let name = "а".repeat(513);
        assert_err!(Notes(name).validate());
    }
}