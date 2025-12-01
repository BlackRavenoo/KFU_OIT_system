-- Add migration script here
BEGIN;

ALTER TABLE tickets ADD COLUMN author_id INT REFERENCES users(id);

ALTER TABLE tickets ADD COLUMN source SMALLINT DEFAULT 0 NOT NULL;

COMMIT;