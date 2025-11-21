-- Add migration script here
BEGIN;

CREATE TABLE departments (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    is_active BOOLEAN NOT NULL DEFAULT true,
    name VARCHAR(80) NOT NULL
);

INSERT INTO departments (name)
VALUES ('ОИТ');

ALTER TABLE tickets ADD COLUMN department_id SMALLINT REFERENCES departments(id) ON DELETE RESTRICT;

UPDATE tickets SET department_id = 1 WHERE department_id IS NULL;

ALTER TABLE tickets ALTER COLUMN department_id SET NOT NULL;

COMMIT;