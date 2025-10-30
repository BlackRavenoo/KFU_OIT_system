-- Add migration script here
CREATE TABLE tags_synonyms(
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL
);

CREATE INDEX idx_tags_synonyms_tag_id ON tags_synonyms(tag_id);
CREATE INDEX trgm_tags_synonyms_name ON tags_synonyms USING GIN(name gin_trgm_ops);