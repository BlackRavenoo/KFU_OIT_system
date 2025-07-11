-- Auth
CREATE TABLE users (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    role SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    author TEXT NOT NULL,
    author_contacts TEXT NOT NULL,
    status SMALLINT DEFAULT 0,
    priority SMALLINT DEFAULT 0,
    assigned_to INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_attachments (
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    s3_key UUID NOT NULL,
    content_type VARCHAR(100),
    PRIMARY KEY (ticket_id, s3_key)
);

-- admin@example.com admin
INSERT INTO users (name, email, password_hash, role)
VALUES ('admin', 'admin@example.com', '$argon2id$v=19$m=19456,t=2,p=1$842ILagOz0rdwfNELPZhPg$KobLaelwC6ZPo2X0555H1rbyPlBo/+N7G+N2NOvKS7w', 2);