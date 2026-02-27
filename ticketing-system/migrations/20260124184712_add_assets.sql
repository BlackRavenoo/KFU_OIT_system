-- Add migration script here
BEGIN;

CREATE TABLE asset_categories (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(32) NOT NULL,
    color VARCHAR(6) NOT NULL CHECK (color ~ '^[0-9A-Fa-f]{6}$'),
    notes VARCHAR(512)
);

CREATE TABLE asset_statuses (
    id SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(32) NOT NULL,
    color VARCHAR(6) NOT NULL CHECK (color ~ '^[0-9A-Fa-f]{6}$')
);

CREATE TABLE asset_models (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(128) NOT NULL,
    category SMALLINT NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT
);

CREATE TABLE assets (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    model_id INT NOT NULL REFERENCES asset_models(id) ON DELETE RESTRICT,
    status SMALLINT NOT NULL REFERENCES asset_statuses(id) ON DELETE RESTRICT,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    serial_number VARCHAR(64),
    inventory_number VARCHAR(64),
    location VARCHAR(128),
    assigned_to VARCHAR(128),
    ip INET,
    mac MACADDR
);

CREATE INDEX idx_assets_models_category ON asset_models (category);

CREATE INDEX idx_assets_model_id ON assets (model_id);
CREATE INDEX idx_assets_status ON assets (status);

CREATE INDEX idx_assets_ip ON assets (ip) WHERE ip IS NOT NULL;
CREATE INDEX idx_assets_mac ON assets (mac) WHERE mac IS NOT NULL;

INSERT INTO asset_statuses(name, color)
VALUES ('Используется', '3B82F6'),
('В наличии', '10B981'),
('В ремонте', 'F59E0B'),
('Утеряно', 'EF4444'),
('Зарезервировано', '8B5CF6'),
('На списание', '6B7280');

INSERT INTO asset_categories(name, color)
VALUES ('Компьютеры', '3B82F6'),
('Ноутбуки', '06B6D4'),
('Принтеры', '8B5CF6'),
('Сканеры', 'A855F7'),
('МФУ', 'EC4899'),
('Сетевое оборудование', '10B981'),
('Мыши', 'F59E0B'),
('Клавиатуры', 'F97316'),
('Мониторы', '6366F1'),
('Камеры', 'EF4444');

COMMIT;