-- Add migration script here
BEGIN;

ALTER TABLE assets
    ADD COLUMN commission_date TIMESTAMPTZ,
    ADD COLUMN decommission_date TIMESTAMPTZ;

COMMIT;