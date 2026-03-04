use garde::Validate;

#[derive(Debug, Validate)]
#[garde(transparent)]
pub struct AssetCategoryName(#[garde(length(max = 32))] String);

impl AsRef<str> for AssetCategoryName {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::AssetCategoryName;
    use garde::Validate;
    use proptest::{prelude::*, string::string_regex};

    fn valid_name_strategy() -> impl Strategy<Value = String> {
        string_regex("[ -~]{0,32}").unwrap()
    }
    
    fn invalid_name_strategy() -> impl Strategy<Value = String> {
        string_regex("[ -~]{33,100}").unwrap()
    }

    proptest! {
        #[test]
        fn valid_names_are_parsed_successfully(name in valid_name_strategy()) {
            prop_assert!(AssetCategoryName(name).validate().is_ok());
        }

        #[test]
        fn invalid_names_are_rejected(name in invalid_name_strategy()) {
            prop_assert!(AssetCategoryName(name).validate().is_err());
        }
    }

    #[test]
    fn test_parse_valid_edge_cases() {
        let cases = vec![
            "".to_string(),
            "a".repeat(1),
            "a".repeat(32),
        ];

        for name in cases {
            let result = AssetCategoryName(name.clone());
            assert!(result.validate().is_ok());
            assert_eq!(result.as_ref(), name);
        }
    }

    #[test]
    fn test_parse_invalid_too_long() {
        let name = "x".repeat(33);
        assert!(AssetCategoryName(name).validate().is_err());
    }
}