pub trait ActionTokenName {
    fn as_str(&self) -> &'static str;
}

#[derive(Clone, Copy, Debug)]
pub enum ActionTokenKind {
    PasswordRecovery,
    AdminTransfer,
}

impl ActionTokenName for ActionTokenKind {
    fn as_str(&self) -> &'static str {
        match self {
            ActionTokenKind::PasswordRecovery => "password_recovery",
            ActionTokenKind::AdminTransfer => "admin_transfer",
        }
    }
}
