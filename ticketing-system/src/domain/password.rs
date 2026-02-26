use argon2::{password_hash::{self, rand_core::OsRng, SaltString}, Argon2, PasswordHasher as _};
use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct Password(
    #[garde(
        length(bytes, min = 8, max = 64),
        ascii,
        custom(validate_password_chars)
    )]
    String
);

fn validate_password_chars(value: &str, _: &()) -> garde::Result {
    if !value.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err(garde::Error::new("Password must contain at least one letter"));
    }
    if !value.chars().any(|c| c.is_ascii_digit()) {
        return Err(garde::Error::new("Password must contain at least one digit"));
    }
    Ok(())
}

impl Password {
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

#[cfg(test)]
mod tests {
    use super::Password;
    use claims::assert_err;
    use fake::{faker::internet::en, Fake as _, rand::{rngs::StdRng, SeedableRng as _}};
    use garde::Validate;
    use proptest::{prelude::{any, Strategy}, prop_assert, proptest};

    #[test]
    fn short_password_is_rejected() {
        let pass = "pass1".to_string();
        assert_err!(Password(pass).validate());
    }

    #[test]
    fn long_password_is_rejected() {
        let pass = "a1".repeat(33).to_string();
        assert_err!(Password(pass).validate());
    }

    #[test]
    fn password_without_letters_is_rejected() {
        let pass = "123456789".to_string();
        assert_err!(Password(pass).validate());
    }

    #[test]
    fn password_without_digits_is_rejected() {
        let pass = "abcabcabc".to_string();
        assert_err!(Password(pass).validate());
    }

    #[test]
    fn password_with_non_ascii_chars_is_rejected() {
        let pass = "Пароль1312".to_string();
        assert_err!(Password(pass).validate());
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
            prop_assert!(Password(email).validate().is_ok());
        }
    }
}