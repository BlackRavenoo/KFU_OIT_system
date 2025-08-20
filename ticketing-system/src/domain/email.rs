use serde::Deserialize;
use validator::ValidateEmail;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Email(String);

impl Email {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.validate_email() {
            Ok(Self(s))
        } else {
            Err(format!("{} is not a valid email", s))
        }
    }
}

impl AsRef<str> for Email {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Email {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl std::fmt::Display for Email {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use super::Email;
    use fake::{faker::internet::en::SafeEmail, rand::{rngs::StdRng, SeedableRng as _}, Fake as _};
    use proptest::{prelude::{any, Strategy}, prop_assert, proptest};
    
    fn valid_email_strategy() -> impl Strategy<Value = String> {
        any::<u64>().prop_map(|seed| {
            let mut rng = StdRng::seed_from_u64(seed);
            SafeEmail().fake_with_rng(&mut rng)
        })
    }

    proptest! {
        #[test]
        fn valid_emails_are_parsed_successfully(email in valid_email_strategy()) {
            prop_assert!(Email::parse(email).is_ok());
        }
    }
}