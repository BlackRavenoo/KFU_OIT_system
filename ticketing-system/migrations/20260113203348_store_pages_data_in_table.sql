-- Add migration script here
ALTER TABLE pages
DROP COLUMN key;

DROP INDEX idx_pages_text_trgm;