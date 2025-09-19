CREATE EXTENSION pg_trgm;

-- Auth
CREATE TABLE users (
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    role SMALLINT NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 0,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL
);

-- Tickets
CREATE TABLE buildings (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT true,
    code VARCHAR(6) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    planned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status SMALLINT NOT NULL DEFAULT 0 CHECK (status BETWEEN 0 AND 3),
    priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    building_id SMALLINT REFERENCES buildings(id) ON DELETE RESTRICT NOT NULL,
    title VARCHAR(256) NOT NULL,
    author VARCHAR(128) NOT NULL,
    author_contacts VARCHAR(16) NOT NULL,
    cabinet VARCHAR(16),
    note VARCHAR(256),
    description TEXT NOT NULL
);

CREATE TABLE tickets_users (
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    assigned_to INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (assigned_to, ticket_id)
);

CREATE TABLE ticket_attachments (
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL,
    PRIMARY KEY (ticket_id, key)
);

CREATE INDEX trgm_tickets_title ON tickets USING GIN(title gin_trgm_ops);

-- admin@example.com admin
INSERT INTO users (name, email, password_hash, role)
VALUES ('admin', 'admin@example.com', '$argon2id$v=19$m=19456,t=2,p=1$842ILagOz0rdwfNELPZhPg$KobLaelwC6ZPo2X0555H1rbyPlBo/+N7G+N2NOvKS7w', 2);

INSERT INTO buildings (code, name)
VALUES ('MAIN', 'Главное здание'),
('BIO', 'Биофак'),
('PSY', 'Психфак'),
('SCH', 'Школа'),
('USC', 'УСК'),
('DORM1', 'Общежитие 1'),
('DORM2', 'Общежитие 2'),
('CAFE', 'Кафе'),
('BUR', 'Буревестник');