use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub struct Name(String);

impl Name {
    pub fn parse(s: String) -> Result<Self, String> {
        if s.len() > 128 {
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