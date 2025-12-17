-- Add migration script here
CREATE TABLE ticket_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    message_text TEXT NOT NULL
);

CREATE INDEX idx_ticket_messages_ticket_created ON ticket_messages(ticket_id, created_at DESC);