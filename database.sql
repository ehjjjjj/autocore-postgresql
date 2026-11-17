-- Run after autoservice_case_all_in_one.sql.
-- Adds a web-facing table without changing the existing course tables.
CREATE SCHEMA IF NOT EXISTS autoservice;
SET search_path TO autoservice;

CREATE TABLE IF NOT EXISTS website_requests (
    request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_number VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    car VARCHAR(120) NOT NULL,
    license_plate VARCHAR(30),
    service_code VARCHAR(30) NOT NULL CHECK (service_code IN ('diagnostics', 'maintenance', 'suspension', 'electrics', 'engine')),
    preferred_date DATE NOT NULL,
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Заявка принята' CHECK (status IN ('Заявка принята', 'Подтверждена', 'В работе', 'Завершена', 'Отменена')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS website_requests_preferred_date_idx
    ON website_requests (preferred_date);
