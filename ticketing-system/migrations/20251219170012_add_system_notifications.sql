-- Add migration script here
CREATE TABLE system_notifications (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_until TIMESTAMPTZ,
    category SMALLINT NOT NULL,
    text TEXT NOT NULL
);