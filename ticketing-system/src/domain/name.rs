use serde::Deserialize;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Name(String);

impl Name {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.graphemes(true).count() > 128 {
            return Err("Name cannot be longer than 128 characters".to_string());
        }
        
        if !s.chars().all(|c| matches!(c, 'А'..='Я' | 'а'..='я' | ' ')) {
            return Err("Name must contain only Cyrillic characters".to_string());
        }
        
        if s.trim().is_empty() {
            return Err("Name cannot be empty".to_string());
        }
        
        Ok(Name(s))
    }
}

impl AsRef<str> for Name {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Name {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for Name {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::Name;
    use claim::{assert_err, assert_ok};
    use fake::{faker::name::en, rand::{rngs::StdRng, SeedableRng as _}, Fake as _};
    use proptest::{prelude::{any, Strategy}, prop_assert, proptest};

    #[test]
    fn empty_string_is_rejected() {
        let name = "".to_string();
        assert_err!(Name::parse(name));
    }

    #[test]
    fn a_128_grapheme_long_name_is_valid() {
        let name = "а".repeat(128);
        assert_ok!(Name::parse(name));
    }

    #[test]
    fn a_129_grapheme_long_name_is_rejected() {
        let name = "а".repeat(129);
        assert_err!(Name::parse(name));
    }

    fn valid_name_strategy() -> impl Strategy<Value = String> {
        any::<u64>().prop_map(|seed| {
            let mut rng = StdRng::seed_from_u64(seed);
            en::Name().fake_with_rng(&mut rng)
        })
    }

    proptest! {
        #[test]
        fn invalid_names_are_rejected(email in valid_name_strategy()) {
            prop_assert!(Name::parse(email).is_err());
        }
    }
}