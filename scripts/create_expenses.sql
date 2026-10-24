-- scripts/create_expenses.sql
-- Run this script in Supabase SQL Editor to create the expenses table

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'อื่นๆ',
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'โอนเงิน/QR',
  title TEXT NOT NULL,
  notes TEXT,
  created_by TEXT DEFAULT 'ผู้จัดการร้าน',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure created_by column exists if table was already created
ALTER TABLE IF EXISTS public.expenses 
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'ผู้จัดการร้าน';

-- Index on expense_date for monthly reporting
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (expense_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow read and write for anon & authenticated roles (POS standalone flow)
DROP POLICY IF EXISTS "Allow all for expenses" ON public.expenses;
CREATE POLICY "Allow all for expenses" ON public.expenses
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
