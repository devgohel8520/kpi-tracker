-- Add columns for data_type, has_target, has_remarks
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'number';
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS has_target BOOLEAN DEFAULT false;
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS has_remarks BOOLEAN DEFAULT false;