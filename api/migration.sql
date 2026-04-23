-- Add missing columns to kpis table
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'number';
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS has_target BOOLEAN DEFAULT false;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS has_remarks BOOLEAN DEFAULT false;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS repeat_on TEXT DEFAULT 'daily';
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS repeat_day INTEGER;

-- Add remarks column to records table
ALTER TABLE records ADD COLUMN IF NOT EXISTS remarks TEXT;