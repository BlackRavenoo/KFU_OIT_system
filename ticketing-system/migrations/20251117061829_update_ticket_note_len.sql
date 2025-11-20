-- Add migration script here
ALTER TABLE tickets 
ALTER COLUMN note TYPE VARCHAR(1024);