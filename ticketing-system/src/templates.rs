use sailfish::Template;

#[derive(Template)]
#[template(path = "registration_confirm.html")]
pub struct InviteTemplate<'a> {
    pub base_url: &'a str,
    pub link: String,
}