-- Add migration script here
BEGIN;

ALTER TABLE assets
    ADD COLUMN photo_key VARCHAR(64);

COMMIT;