-- PostgreSQL Schema for KPI Tracker
-- Run this in your PostgreSQL database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KPIs table
CREATE TABLE IF NOT EXISTS kpis (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner VARCHAR(255),
    data_type VARCHAR(20) NOT NULL DEFAULT 'number',
    has_target BOOLEAN DEFAULT FALSE,
    target DECIMAL(15,4),
    has_remarks BOOLEAN DEFAULT FALSE,
    repeat_on VARCHAR(20) NOT NULL DEFAULT 'daily',
    repeat_day VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Records table
CREATE TABLE IF NOT EXISTS records (
    id VARCHAR(50) PRIMARY KEY,
    kpi_id VARCHAR(50) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kpi_id) REFERENCES kpis(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kpis_user_id ON kpis(user_id);
CREATE INDEX IF NOT EXISTS idx_records_kpi_id ON records(kpi_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);