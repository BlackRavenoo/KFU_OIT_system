-- Add migration script here
DROP INDEX idx_notifications_user;

CREATE INDEX idx_notifications_created_at_user
ON notifications (user_id, created_at ASC);

CREATE OR REPLACE FUNCTION limit_notifications_per_user()
RETURNS TRIGGER AS $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM notifications
    WHERE user_id = NEW.user_id;

    IF cnt >= 100 THEN
        DELETE FROM notifications
        WHERE id = (
            SELECT id
            FROM notifications
            WHERE user_id = NEW.user_id
            ORDER BY created_at ASC
            LIMIT 1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_limit_notifications
BEFORE INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION limit_notifications_per_user();