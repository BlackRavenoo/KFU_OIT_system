-- Add migration script here
CREATE UNIQUE INDEX idx_tags_name ON tags (name);