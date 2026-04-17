-- Add migration script here
BEGIN;

ALTER TABLE tickets
    ADD COLUMN first_response_at TIMESTAMPTZ,
    ADD COLUMN closed_at TIMESTAMPTZ,
    ADD COLUMN is_long_term BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_tickets_closed ON tickets (closed_at) WHERE closed_at IS NOT NULL;

COMMIT;