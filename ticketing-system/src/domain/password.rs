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