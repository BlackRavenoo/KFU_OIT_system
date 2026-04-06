-- Add migration script here
CREATE TABLE ticket_assets (
    ticket_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    comment TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);