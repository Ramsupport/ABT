-- Agreement Manager Database Schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    location TEXT NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    agent_name VARCHAR(100),
    agreement_date DATE NOT NULL,
    stamp_duty DECIMAL(10,2) DEFAULT 0,
    registration_charges DECIMAL(10,2) DEFAULT 1000,
    dhc DECIMAL(10,2) DEFAULT 300,
    service_charge DECIMAL(10,2) DEFAULT 0,
    police_verification DECIMAL(10,2) DEFAULT 0,
    total_payment DECIMAL(10,2) DEFAULT 0,
    payment_received DECIMAL(10,2) DEFAULT 0,
    payment_received_date DATE,
    payment_due DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_name ON agreements(agent_name);
CREATE INDEX idx_agreement_date ON agreements(agreement_date);
CREATE INDEX idx_payment_due ON agreements(payment_due);
CREATE INDEX idx_user_id ON agreements(user_id);