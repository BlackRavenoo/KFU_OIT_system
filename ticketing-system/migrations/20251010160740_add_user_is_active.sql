-- Add migration script here
BEGIN;

ALTER TABLE users ADD COLUMN is_active BOOLEAN;

UPDATE users
SET is_active = CASE
    WHEN status = 3 THEN false
    ELSE true
END;

ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;

COMMIT;