use sailfish::Template;

#[derive(Template)]
#[template(path = "registration_confirm.html")]
pub struct InviteTemplate<'a> {
    pub base_url: &'a str,
    pub link: String,
}

#[derive(Template)]
#[template(path = "reset_password.html")]
pub struct ResetPasswordTemplate<'a> {
    pub base_url: &'a str,
    pub link: String,
}