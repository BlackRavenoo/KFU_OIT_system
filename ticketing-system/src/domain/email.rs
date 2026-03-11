use garde::Validate;
use serde::Deserialize;

use crate::string_newtype;

#[derive(Debug, Deserialize, Validate)]
pub struct Email(#[garde(email)] String);

impl Email {
    pub fn parse(value: impl Into<String>) -> Result<Self, garde::Report> {
        let email = Email(value.into());
        email.validate()?;
        Ok(email)
    }
}

string_newtype!(Email);

#[cfg(test)]
mod tests {
    use super::Email;
    use fake::{faker::internet::en::SafeEmail, rand::{rngs::StdRng, SeedableRng as _}, Fake as _};
    use garde::Validate;
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
            prop_assert!(Email(email).validate().is_ok());
        }
    }
}