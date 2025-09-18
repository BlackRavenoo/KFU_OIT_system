use argon2::{password_hash::{self, rand_core::OsRng, SaltString}, Argon2, PasswordHasher as _};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Password(String);

impl Password {
    pub fn parse(s: String) -> Result<Self, String> {
        let is_valid_length = s.len() >= 8 && s.len() <= 64;
        
        let has_letter = s.chars().any(|c| c.is_ascii_alphabetic());
        let has_digit = s.chars().any(|c| c.is_ascii_digit());
        let is_ascii_only = s.is_ascii();
        
        let has_required_chars = has_letter && has_digit && is_ascii_only;

        if is_valid_length && has_required_chars {
            Ok(Password(s))
        } else {
            Err(format!("{} is not a valid password", s))
        }
    }

    pub fn hash(self) -> Result<String, password_hash::Error> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();

        argon2
            .hash_password(self.0.as_bytes(), &salt)
            .map(|hash| hash.to_string())
    }
}

impl AsRef<str> for Password {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl TryFrom<String> for Password {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

#[cfg(test)]
mod tests {
    use super::Password;
    use claims::assert_err;
    use fake::{faker::internet::en, Fake as _};
    use proptest::{prelude::{any, Strategy}, prop_assert, proptest};
    use rand::{rngs::StdRng, SeedableRng as _};

    #[test]
    fn short_password_is_rejected() {
        let pass = "pass1".to_string();
        assert_err!(Password::parse(pass));
    }

    #[test]
    fn long_password_is_rejected() {
        let pass = "a1".repeat(33).to_string();
        assert_err!(Password::parse(pass));
    }

    #[test]
    fn password_without_letters_is_rejected() {
        let pass = "123456789".to_string();
        assert_err!(Password::parse(pass));
    }

    #[test]
    fn password_without_digits_is_rejected() {
        let pass = "abcabcabc".to_string();
        assert_err!(Password::parse(pass));
    }

    #[test]
    fn password_with_non_ascii_chars_is_rejected() {
        let pass = "Пароль1312".to_string();
        assert_err!(Password::parse(pass));
    }

    fn valid_password_strategy() -> impl Strategy<Value = String> {
        any::<u64>().prop_map(|seed| {
            let mut rng = StdRng::seed_from_u64(seed);
            let mut pass: String = en::Password(7..64).fake_with_rng(&mut rng);
            pass.push('1');
            pass
        })
    }

    proptest! {
        #[test]
        fn valid_emails_are_parsed_successfully(email in valid_password_strategy()) {
            prop_assert!(Password::parse(email).is_ok());
        }
    }
}