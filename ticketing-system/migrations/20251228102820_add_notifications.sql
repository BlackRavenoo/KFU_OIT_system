-- Add migration script here
BEGIN;

CREATE TABLE notifications (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    read BOOL NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL
);

CREATE UNIQUE INDEX idx_notifications_user_ticket_new_messages 
ON notifications (user_id, ticket_id) 
WHERE NOT read AND payload->>'type' = 'new_messages';

CREATE INDEX idx_notifications_user
ON notifications (user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

COMMIT;