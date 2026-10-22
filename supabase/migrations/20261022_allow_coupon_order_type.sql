-- ============================================================================
-- Migration: Allow 'coupon' in orders_order_type_check
-- Fur Fur POS: รองรับคำสั่งซื้อประเภทคูปอง (CPN-XXXX) ในตาราง orders
-- ============================================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check 
  CHECK (order_type IN ('grooming', 'retail', 'membership', 'coupon'));
