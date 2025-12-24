-- Add migration script here
BEGIN;

INSERT INTO ticket_messages (ticket_id, user_id, is_internal, message_text)
SELECT t.id,
       1,
       TRUE,
       t.note
FROM tickets t
WHERE t.note IS NOT NULL AND length(trim(t.note)) > 0;

ALTER TABLE tickets DROP COLUMN note;

COMMIT;