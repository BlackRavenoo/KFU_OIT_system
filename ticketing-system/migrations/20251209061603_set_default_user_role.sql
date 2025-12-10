-- Add migration script here
BEGIN;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 1;

UPDATE users
SET role = role + 1
WHERE role > 0;

COMMIT;