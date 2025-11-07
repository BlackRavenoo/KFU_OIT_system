-- Add migration script here
BEGIN;

UPDATE users
SET role = role + 1;

INSERT INTO users (name, email, login, password_hash, role)
VALUES ('КФУ', 'client@example.com', 'clientKFU', '$argon2id$v=19$m=19456,t=2,p=1$zjCM9XOGQF9aQy0JZ6BDHQ$MRUaxQE4wnewL/SS39PI3zVc8jYVXwzO/rj/hJmlGz0', 0);

COMMIT;