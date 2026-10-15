-- ============================================================================
-- Fur Fur POS: Atomic Sequential Numbering System (PostgreSQL / Supabase)
-- ป้องกัน Race Condition เลขที่บิลซ้ำ และ Running Number ชนกัน 100%
-- ============================================================================

-- 1. สร้างตารางเก็บเลขที่ Sequence ประจำแต่ละ Prefix
CREATE TABLE IF NOT EXISTS public.order_sequences (
  prefix TEXT PRIMARY KEY,
  last_val INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ปิด/เปิด RLS เพื่อความปลอดภัย
ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all users to manage sequences" ON public.order_sequences;
CREATE POLICY "Allow all users to manage sequences"
ON public.order_sequences
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- 2. สร้าง Function Atomic Sequence สำหรับเลขที่บิลคำสั่งซื้อ (GRM-, RTL-, CPN-, MEM-)
-- รูปแบบ: {PREFIX}-YYYYMM-XXXX เช่น GRM-202610-0001
CREATE OR REPLACE FUNCTION public.get_next_order_number(p_order_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_ym TEXT;
  v_key TEXT;
  v_seq INTEGER;
BEGIN
  -- กำหนด Prefix ตามประเภทคำสั่งซื้อ
  CASE LOWER(TRIM(p_order_type))
    WHEN 'grooming' THEN v_prefix := 'GRM';
    WHEN 'retail' THEN v_prefix := 'RTL';
    WHEN 'coupon' THEN v_prefix := 'CPN';
    WHEN 'membership' THEN v_prefix := 'MEM';
    ELSE RAISE EXCEPTION 'Invalid order type: %', p_order_type;
  END CASE;

  -- ปีเดือนตามเวลาประเทศไทย (Asia/Bangkok)
  v_ym := to_char(timezone('Asia/Bangkok', now()), 'YYYYMM');
  v_key := v_prefix || '-' || v_ym;

  -- กรณีเริ่มเดือนใหม่ หรือยังไม่มีแถว prefix ในตาราง: ค้นหาเลขสูงสุดจาก orders ก่อน
  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = v_key) THEN
    SELECT COALESCE(MAX(SUBSTRING(order_number FROM '\d+$')::INTEGER), 0)
    INTO v_seq
    FROM public.orders
    WHERE order_number LIKE v_key || '-%';

    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES (v_key, v_seq + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = public.order_sequences.last_val + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    -- Atomic Row Lock Increment
    UPDATE public.order_sequences
    SET 
      last_val = last_val + 1,
      updated_at = now()
    WHERE prefix = v_key
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN v_key || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- 3. Function สำหรับรหัสสมาชิก (MB-XXXX)
CREATE OR REPLACE FUNCTION public.get_next_member_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'MB') THEN
    SELECT COALESCE(MAX(SUBSTRING(member_code FROM '\d+$')::INTEGER), 0)
    INTO v_seq
    FROM public.annual_memberships
    WHERE member_code ~ '^MB-\d+$';

    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('MB', v_seq + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = public.order_sequences.last_val + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = last_val + 1,
      updated_at = now()
    WHERE prefix = 'MB'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'MB-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- 4. Function สำหรับรหัสคูปอง (CP-XXX)
CREATE OR REPLACE FUNCTION public.get_next_coupon_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'CP') THEN
    SELECT COALESCE(MAX(SUBSTRING(coupon_code FROM '\d+$')::INTEGER), 0)
    INTO v_seq
    FROM public.coupons
    WHERE coupon_code ~ '^CP-\d+$';

    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('CP', v_seq + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = public.order_sequences.last_val + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = last_val + 1,
      updated_at = now()
    WHERE prefix = 'CP'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'CP-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- 5. Function สำหรับรหัสสัตว์เลี้ยง (PET-XXXX)
CREATE OR REPLACE FUNCTION public.get_next_pet_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'PET') THEN
    SELECT COALESCE(MAX(SUBSTRING(pet_code FROM '\d+$')::INTEGER), 0)
    INTO v_seq
    FROM public.pets
    WHERE pet_code ~ '^PET-\d+$';

    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('PET', v_seq + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = public.order_sequences.last_val + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = last_val + 1,
      updated_at = now()
    WHERE prefix = 'PET'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'PET-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- 6. ให้สิทธิ Execute Function แก่ทุก Role
GRANT EXECUTE ON FUNCTION public.get_next_order_number(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_member_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_coupon_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_pet_code() TO anon, authenticated, service_role;

-- 7. เพิ่ม Unique Constraint ให้กับ order_number ใน orders ป้องกันเลขซ้ำระดับ Database
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END $$;
