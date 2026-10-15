-- scripts/create_daily_closings.sql
-- Run this script in Supabase SQL Editor to create the daily_closings table

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL UNIQUE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by TEXT NOT NULL DEFAULT 'แคชเชียร์ / ช่างฟาริ',
  total_orders_count INTEGER NOT NULL DEFAULT 0,
  system_total_sales NUMERIC NOT NULL DEFAULT 0,
  system_cash_amount NUMERIC NOT NULL DEFAULT 0,
  system_transfer_amount NUMERIC NOT NULL DEFAULT 0,
  system_coupon_deducted NUMERIC NOT NULL DEFAULT 0,
  cash_expenses NUMERIC NOT NULL DEFAULT 0,
  actual_cash_amount NUMERIC NOT NULL DEFAULT 0,
  cash_difference NUMERIC NOT NULL DEFAULT 0,
  opening_drawer_float NUMERIC NOT NULL DEFAULT 0,
  cash_transferred_out NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ปิดกะเรียบร้อย',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

-- Allow read and write for anon & authenticated roles (POS offline/standalone flow)
DROP POLICY IF EXISTS "Allow all for daily_closings" ON public.daily_closings;
CREATE POLICY "Allow all for daily_closings" ON public.daily_closings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
