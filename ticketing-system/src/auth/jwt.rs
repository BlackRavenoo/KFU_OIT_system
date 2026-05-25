use std::fs;

use anyhow::Context as _;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode_header, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{auth::types::UserRole, config::AuthSettings};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub iat: i64,
    pub exp: i64,
    pub iss: String,
    pub jti: String,
    pub role: UserRole,
}

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    issuer: String,
    pub access_token_lifetime: Duration,
    validation: Validation,
}

impl JwtService {
    pub fn new(auth_settings: &AuthSettings) -> anyhow::Result<Self> {
        let private_key = fs::read(&auth_settings.private_key_path)?;
        
        let public_key = fs::read(&auth_settings.public_key_path)?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = true;
        validation.validate_nbf = true;
        validation.set_issuer(&[&auth_settings.issuer]);
        
        Ok(Self {
            encoding_key: EncodingKey::from_rsa_pem(&private_key)?,
            decoding_key: DecodingKey::from_rsa_pem(&public_key)?,
            issuer: auth_settings.issuer.clone(),
            access_token_lifetime: Duration::from_std(auth_settings.access_token_lifetime)?,
            validation
        })
    }

    pub fn create_access_token(
        &self,
        user_id: i32,
        role: UserRole,
    ) -> Result<String, JwtError> {
        let now = Utc::now();
        let expiry = now + self.access_token_lifetime;
        
        let claims = Claims {
            sub: user_id.to_string(),
            exp: expiry.timestamp(),
            iat: now.timestamp(),
            iss: self.issuer.clone(),
            jti: Uuid::new_v4().to_string(),
            role
        };

        let mut header = Header::new(Algorithm::RS256);
        header.kid = Some("default-key-1".to_string());
        
        Ok(
            jsonwebtoken::encode(&header, &claims, &self.encoding_key)
                .context("Failed to encode token.")?
        )
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, JwtError> {
        let header = decode_header(token)
            .map_err(|e| JwtError::InvalidToken(format!("Invalid header: {}", e)))?;

        let _kid = header.kid
            .ok_or_else(|| JwtError::InvalidToken("Missing kid in header".to_string()))?;

        // TODO: Implement key rotation mechanism
        let key = &self.decoding_key;

        jsonwebtoken::decode::<Claims>(token, key, &self.validation)
            .map(|data| data.claims)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    JwtError::InvalidToken("Token has expired".to_string())
                }
                _ => JwtError::InvalidToken("Failed to decode token".to_string())
            })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum JwtError {
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("Key not found: {0}")]
    KeyNotFound(String),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

#[cfg(test)]
mod tests {
    use std::{fs, time::Duration as StdDuration};

    use super::*;
    use crate::config::AuthSettings;
    use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
    use uuid::Uuid;

    const TEST_PRIVATE_KEY: &str = r#"-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmWIuG79I0mamT
HDdFdU6CmY6estiUi1dUkoqa1R2/z/TEnfami8uGZN9aeSlFOs2UlboH11MsraBw
o+FA69wfzdViRXkiEtUmECa16LgpSsR8yEg3hWyAsom7IuZs7I1HdL1IkkdsGnAU
n4GyAXOf7HUNosPewuB60uSmov9Ol/yPq24ylJgV2JBOggJ/FZWMGJVmjbfE/r6D
MqHlZLjkbwJwstunUCT4rOz3hAoUxwe//3lqD6E0aSKEyO6hT0hCbZtEBPApsL24
b9sT2MGD9HTv43RCzHWg8YHBTou8630bSL3NJLyUNAvuZF9hg76y6o3RKbceLaA9
vcAY3Aj3AgMBAAECggEAD1bfWIxPt2prTCKJwkDxm9kQx5E5QZfVb/oRB/tN2/zc
PS+0qZT+9p/heaFUoFd7OUMGJAHDxla+313TwFdyzzswfMU1SPwXMoRb9xUq7lVz
tKIJCGQOv/g2yGfzSBx9xrB8+yIDrg23qiv8GyMUVROXLUoftjBrea5uFIoeJIWs
JiwknmNeNWVBWTTbgx+NaCUZDKTnolM+VXTkM9OZFFdTDfz9twLWqciESFOISIkF
CIs9gnHhyaM1cDUQ94Qb7cSXcFUtJ3zOsMKGJ+H4cUExCTNglf8+KklrrdfzpnyB
MMdPuyGvyCDBwXIECOdhzWPplbPz/GT8lxKhwlMqyQKBgQDVZHH9Wy6NEbUpy7Cg
Rt3poPVQORf4iPQWprBZUcanEd5XW4pIN3fhH4CidYmbRp9U+qnExA3RmZdfRWjw
WwJLho0Bdu3yuuE95mPzTma+7vpAdTx2tJWKlOiNR13qzuts5IS34QmetOIwmswg
W6mE6KAAmiQuG3Q6buR5G/RVRQKBgQDHj1FZa0mNOYSaR/ZZxhZ0ol3sJ9yjA0rj
aDzGup1CofGfZRlODyWRwaN0xeGRI8CYQ2mp3lAMigcmfQ443A7XxF6lzyoxQx0C
00HkkYx2h4W134LzbrkCE7hAbPFJFNRepQibtNM1pxw7zDZoU9hvA0chRZifikC2
xdvk0MtTCwKBgCONi6xhj7zzMVLYXAIoLHrrVVPbX1IKR1iqxwDqrgVR5dB6MOzd
SPzaCc2HdbjIKG25IaXl4EOGqoC2CMja8OPyc/XFgdmKJ1Lv2sFD07yGBm3M2pkQ
d0XSj3hSZqRjezf2TuJv/PFTQ8hDUjUl8HVzaI0RIWwJKPE/XpOLA8ddAoGAWdSU
3PijolPa8gwkw+KcZyJTvyNueV7ZDib0/MwyUDVP6915l57P3Z3Z843D7S632pK1
9MZjKFHVyCiRB11fvRbjOCZaKtS4MXZhef9eyFhXAzi63NPhqiKwVSf1MV2T/4qw
pk6uqL8xwWU6tJnRmp9SHJMUkfSNDvlf889dR2MCgYEAlwSrtluU5Jnv+YnIu21E
BgFcggFF9mGxPXxpLLXn+aTy514mOjhEj2zYF0Ja89naJ21sVFrCiUxKzPACsgTH
SRlIo3Eaj3Pn4K9Uxi3WXZTsDyKdZIDOrp6Wf8DGDOKTHNIeGK/3T/QiuUjNVVvg
bGXOQxOk6mC1vY7/RJXnz7I=
-----END PRIVATE KEY-----"#;

    const TEST_PUBLIC_KEY: &str = r#"-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApliLhu/SNJmpkxw3RXVO
gpmOnrLYlItXVJKKmtUdv8/0xJ32povLhmTfWnkpRTrNlJW6B9dTLK2gcKPhQOvc
H83VYkV5IhLVJhAmtei4KUrEfMhIN4VsgLKJuyLmbOyNR3S9SJJHbBpwFJ+BsgFz
n+x1DaLD3sLgetLkpqL/Tpf8j6tuMpSYFdiQToICfxWVjBiVZo23xP6+gzKh5WS4
5G8CcLLbp1Ak+Kzs94QKFMcHv/95ag+hNGkihMjuoU9IQm2bRATwKbC9uG/bE9jB
g/R07+N0Qsx1oPGBwU6LvOt9G0i9zSS8lDQL7mRfYYO+suqN0Sm3Hi2gPb3AGNwI
9wIDAQAB
-----END PUBLIC KEY-----"#;

    fn create_test_service(access_token_lifetime: StdDuration) -> JwtService {
        let temp_dir = std::env::temp_dir().join(format!("ticketing-system-jwt-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();

        let private_key_path = temp_dir.join("private.pem");
        let public_key_path = temp_dir.join("public.pem");

        fs::write(&private_key_path, TEST_PRIVATE_KEY).unwrap();
        fs::write(&public_key_path, TEST_PUBLIC_KEY).unwrap();

        let auth_settings = AuthSettings {
            access_token_lifetime,
            refresh_token_lifetime: StdDuration::from_secs(60),
            private_key_path: private_key_path.to_string_lossy().to_string(),
            public_key_path: public_key_path.to_string_lossy().to_string(),
            issuer: "test-issuer".to_string(),
        };

        JwtService::new(&auth_settings).unwrap()
    }

    #[test]
    fn create_and_validate_access_token_roundtrip() {
        let service = create_test_service(StdDuration::from_secs(60));

        let token = service.create_access_token(42, UserRole::Admin).unwrap();
        let claims = service.validate_token(&token).unwrap();

        assert_eq!(claims.sub, "42");
        assert_eq!(claims.iss, "test-issuer");
        assert_eq!(claims.role, UserRole::Admin);
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn validate_token_rejects_invalid_header() {
        let service = create_test_service(StdDuration::from_secs(60));

        let err = service.validate_token("not-a-jwt").unwrap_err();
        assert!(matches!(err, JwtError::InvalidToken(message) if message.contains("Invalid header")));
    }

    #[test]
    fn validate_token_rejects_missing_kid() {
        let service = create_test_service(StdDuration::from_secs(60));
        let private_key = EncodingKey::from_rsa_pem(TEST_PRIVATE_KEY.as_bytes()).unwrap();

        let claims = Claims {
            sub: "7".to_string(),
            iat: 0,
            exp: 9_999_999_999,
            iss: "test-issuer".to_string(),
            jti: Uuid::new_v4().to_string(),
            role: UserRole::Client,
        };

        let mut header = Header::new(Algorithm::RS256);
        header.kid = None;

        let token = encode(&header, &claims, &private_key).unwrap();
        let err = service.validate_token(&token).unwrap_err();

        assert!(matches!(err, JwtError::InvalidToken(message) if message.contains("Missing kid")));
    }

    #[test]
    fn validate_token_rejects_expired_token() {
        let service = create_test_service(StdDuration::from_secs(60));
        let expired_service = JwtService {
            access_token_lifetime: Duration::hours(-1),
            ..service
        };

        let token = expired_service.create_access_token(100, UserRole::Employee).unwrap();
        let err = expired_service.validate_token(&token).unwrap_err();

        assert!(matches!(err, JwtError::InvalidToken(message) if message.contains("expired")));
    }
}