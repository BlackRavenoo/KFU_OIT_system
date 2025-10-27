-- Add migration script here
CREATE INDEX trgm_users_name ON users USING GIN(name gin_trgm_ops);
CREATE INDEX trgm_users_email ON users USING GIN(email gin_trgm_ops);