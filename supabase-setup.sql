-- ============================================================
-- KPI TRACKER - SUPABASE SETUP
-- ============================================================
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create KPIs table
CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data_type TEXT DEFAULT 'number' CHECK (data_type IN ('number', 'percentage', 'yes_no')),
  has_target BOOLEAN DEFAULT false,
  target DECIMAL(15, 4),
  has_remarks BOOLEAN DEFAULT false,
  repeat_on TEXT DEFAULT 'daily' CHECK (repeat_on IN ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'half_yearly', 'yearly')),
  repeat_day TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Records table
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  value DECIMAL(15, 4) NOT NULL,
  date DATE NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for KPIs
CREATE POLICY "Users can CRUD own KPIs" ON kpis
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Create policies for Records
-- Users can see records for their KPIs
CREATE POLICY "Users can CRUD own records" ON records
  FOR ALL
  USING (
    kpi_id IN (SELECT id FROM kpis WHERE user_id = auth.uid())
  )
  WITH CHECK (
    kpi_id IN (SELECT id FROM kpis WHERE user_id = auth.uid())
  );

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpis_user_id ON kpis(user_id);
CREATE INDEX IF NOT EXISTS idx_records_kpi_id ON records(kpi_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);

-- 7. Create function to auto-set user_id on insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This function is called by auth.usersInsertTrigger
  -- Already handled by Supabase Auth
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for development (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE kpis, records;