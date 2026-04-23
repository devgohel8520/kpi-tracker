-- Add description column to kpis table (run in Neon SQL Editor)
ALTER TABLE kpis ADD COLUMN IF NOT EXISTS description TEXT;