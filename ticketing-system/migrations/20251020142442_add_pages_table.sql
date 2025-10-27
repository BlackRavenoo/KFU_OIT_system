-- Add migration script here
BEGIN;

CREATE TABLE pages (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    author INT REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    is_public BOOLEAN NOT NULL,
    title VARCHAR(64) NOT NULL,
    key VARCHAR(64) NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE tags (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(32) NOT NULL
);

CREATE TABLE pages_tags (
    tag_id INT,
    page_id INT,
    PRIMARY KEY (tag_id, page_id)
);

CREATE INDEX idx_pages_title_trgm ON pages USING GIN (title gin_trgm_ops);
CREATE INDEX idx_pages_text_trgm ON pages USING GIN (text gin_trgm_ops);
CREATE INDEX idx_tags_name_trgm ON tags USING GIN (name gin_trgm_ops);

COMMIT;