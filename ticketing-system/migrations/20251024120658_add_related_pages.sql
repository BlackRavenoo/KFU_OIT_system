-- Add migration script here
CREATE TABLE related_pages(
    source_page_id INT REFERENCES pages(id) ON DELETE CASCADE,
    related_page_id INT REFERENCES pages(id) ON DELETE CASCADE,
    PRIMARY KEY (source_page_id, related_page_id),
    CHECK (source_page_id != related_page_id)
);