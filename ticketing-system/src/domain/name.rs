use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Deserialize, Validate)]
pub struct Name(
    #[garde(
        length(graphemes, min = 1, max = 128),
        custom(validate_cyrillic)
    )]
    String
);

fn validate_cyrillic(value: &str, _context: &()) -> garde::Result {
    if value.chars().all(|c| matches!(c, 'А'..='Я' | 'а'..='я' | ' ')) {
        Ok(())
    } else {
        Err(garde::Error::new("Name must contain only Cyrillic characters"))
    }
}

string_newtype!(Name);

#[cfg(test)]
mod tests {
    use super::Name;
    use claims::{assert_err, assert_ok};
    use fake::{faker::name::en, rand::{rngs::StdRng, SeedableRng as _}, Fake as _};
    use garde::Validate;
    use proptest::{prelude::{any, Strategy}, prop_assert, proptest};

    #[test]
    fn empty_string_is_rejected() {
        let name = "".to_string();
        assert_err!(Name(name).validate());
    }

    #[test]
    fn a_128_grapheme_long_name_is_valid() {
        let name = "а".repeat(128);
        assert_ok!(Name(name).validate());
    }

    #[test]
    fn a_129_grapheme_long_name_is_rejected() {
        let name = "а".repeat(129);
        assert_err!(Name(name).validate());
    }

    fn invalid_name_strategy() -> impl Strategy<Value = String> {
        any::<u64>().prop_map(|seed| {
            let mut rng = StdRng::seed_from_u64(seed);
            en::Name().fake_with_rng(&mut rng)
        })
    }

    proptest! {
        #[test]
        fn invalid_names_are_rejected(name in invalid_name_strategy()) {
            prop_assert!(Name(name).validate().is_err());
        }
    }
}