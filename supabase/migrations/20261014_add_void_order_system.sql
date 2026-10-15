-- ============================================================================
-- Migration: Add Void / Cancellation System to Orders
-- Fur Fur POS: ระบบยกเลิกบิล (Void Bill) และบันทึกสาเหตุการยกเลิก
-- ============================================================================

-- 1. เพิ่มคอลัมน์ status, void_reason, voided_at, voided_by ในตาราง orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS void_reason TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS voided_by TEXT;

-- 2. สร้าง Index เพื่อประสิทธิภาพในการค้นหาและกรองบิลที่ยังใช้งานอยู่
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date_status ON public.orders(order_date, status);

COMMENT ON COLUMN public.orders.status IS 'สถานะบิล: completed (สมบูรณ์) หรือ voided (ยกเลิกแล้ว)';
COMMENT ON COLUMN public.orders.void_reason IS 'สาเหตุในการยกเลิกบิล เช่น คีย์ยอดผิด, ลูกค้าเปลี่ยนใจ';
COMMENT ON COLUMN public.orders.voided_at IS 'วันเวลาที่ทำรายการยกเลิกบิล';
COMMENT ON COLUMN public.orders.voided_by IS 'ชื่อพนักงานหรือแคชเชียร์ที่กดยกเลิกบิล';
