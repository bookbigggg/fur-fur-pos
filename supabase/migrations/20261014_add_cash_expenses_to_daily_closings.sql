-- ============================================================================
-- Migration: Add cash_expenses to daily_closings table
-- Fur Fur POS: รองรับการหักเงินสดจ่ายออก (Cash Expenses) ในการกระทบยอดเงินสด
-- ============================================================================

ALTER TABLE public.daily_closings 
ADD COLUMN IF NOT EXISTS cash_expenses NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.daily_closings.cash_expenses IS 'ยอดเงินสดจ่ายออกตามระบบ (ค่าใช้จ่ายที่จ่ายด้วยเงินสดในวันนั้น)';
