use garde::Validate;
use serde::Deserialize;

#[derive(Debug, Validate, Deserialize)]
pub struct Color(
    #[garde(pattern(r"^#[0-9A-Fa-f]{6}$"))]
    String
);

impl AsRef<str> for Color {
    fn as_ref(&self) -> &str {
        &self.0[1..]
    }
}

#[cfg(test)]
mod tests {
    use super::Color;
    use garde::Validate;
    use proptest::{prelude::Strategy, prop_assert, prop_oneof, proptest};
    
    fn valid_color_strategy() -> impl Strategy<Value = String> {
        "[A-Fa-f0-9]{6}".prop_map(|hex: String| format!("#{}", hex))
    }

    fn invalid_color_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            ".*".prop_filter("Invalid length", |s| s.len() != 7),
            "[^#].*".prop_map(|s| format!("#{}", s)),
            "[A-Za-z0-9]{7}".prop_filter("Invalid characters", |s| !s.starts_with('#')),
        ]
    }

    proptest! {
        #[test]
        fn valid_colors_are_parsed_successfully(color in valid_color_strategy()) {
            prop_assert!(Color(color).validate().is_ok());
        }

        #[test]
        fn invalid_colors_are_rejected(color in invalid_color_strategy()) {
            prop_assert!(Color(color).validate().is_err());
        }
    }
}