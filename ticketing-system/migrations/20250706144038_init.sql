-- Auth
CREATE TABLE users (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE buildings (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    author TEXT NOT NULL,
    author_contacts TEXT NOT NULL,
    status SMALLINT NOT NULL DEFAULT 0 CHECK (status BETWEEN 0 AND 3),
    priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    planned_at TIMESTAMPTZ,
    cabinet VARCHAR(16),
    note VARCHAR(255),
    building_id SMALLINT REFERENCES buildings(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets_users (
    assigned_to INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    PRIMARY KEY (assigned_to, ticket_id)
);

CREATE TABLE ticket_attachments (
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL,
    PRIMARY KEY (ticket_id, key)
);

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
