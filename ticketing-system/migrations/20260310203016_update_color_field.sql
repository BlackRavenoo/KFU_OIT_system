-- Add migration script here
BEGIN;

ALTER TABLE asset_statuses
    DROP CONSTRAINT asset_statuses_color_check;

ALTER TABLE asset_statuses
    ALTER COLUMN color TYPE VARCHAR(7);

UPDATE asset_statuses
    SET color = '#' || color
    WHERE color !~ '^#';

ALTER TABLE asset_statuses
    ADD CONSTRAINT asset_statuses_color_check 
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE asset_categories
    DROP CONSTRAINT asset_categories_color_check;

ALTER TABLE asset_categories
    ALTER COLUMN color TYPE VARCHAR(7);

UPDATE asset_categories
    SET color = '#' || color
    WHERE color !~ '^#';

ALTER TABLE asset_categories
    ADD CONSTRAINT asset_categories_color_check 
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

COMMIT;