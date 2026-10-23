-- ============================================================================
-- Fur Fur POS: Self-Healing Atomic Sequences System (PostgreSQL / Supabase)
-- ป้องกัน Sequence ถอยหลัง หรือเลขที่ซ้ำจากกรณี manual insert / CSV import
-- ============================================================================

-- 1. อัปเดต Function get_next_pet_code() ให้เช็ค GREATEST กับ MAX ใน pets เสมอ
CREATE OR REPLACE FUNCTION public.get_next_pet_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_max_table INTEGER;
BEGIN
  -- หาเลขสูงสุดที่มีอยู่ในตาราง pets ปัจจุบันเสมอ
  SELECT COALESCE(MAX(SUBSTRING(pet_code FROM '\d+$')::INTEGER), 0)
  INTO v_max_table
  FROM public.pets
  WHERE pet_code ~ '^PET-\d+$';

  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'PET') THEN
    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('PET', v_max_table + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = GREATEST(public.order_sequences.last_val, v_max_table) + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = GREATEST(last_val, v_max_table) + 1,
      updated_at = now()
    WHERE prefix = 'PET'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'PET-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- 2. อัปเดต Function get_next_member_code() ให้เช็ค GREATEST กับ MAX ใน annual_memberships เสมอ
CREATE OR REPLACE FUNCTION public.get_next_member_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_max_table INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(member_code FROM '\d+$')::INTEGER), 0)
  INTO v_max_table
  FROM public.annual_memberships
  WHERE member_code ~ '^MB-\d+$';

  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'MB') THEN
    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('MB', v_max_table + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = GREATEST(public.order_sequences.last_val, v_max_table) + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = GREATEST(last_val, v_max_table) + 1,
      updated_at = now()
    WHERE prefix = 'MB'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'MB-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- 3. อัปเดต Function get_next_coupon_code() ให้เช็ค GREATEST กับ MAX ใน coupons เสมอ
CREATE OR REPLACE FUNCTION public.get_next_coupon_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_max_table INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(coupon_code FROM '\d+$')::INTEGER), 0)
  INTO v_max_table
  FROM public.coupons
  WHERE coupon_code ~ '^CP-\d+$';

  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = 'CP') THEN
    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES ('CP', v_max_table + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = GREATEST(public.order_sequences.last_val, v_max_table) + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = GREATEST(last_val, v_max_table) + 1,
      updated_at = now()
    WHERE prefix = 'CP'
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN 'CP-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

-- 4. อัปเดต Function get_next_order_number(p_order_type TEXT) ให้เช็ค GREATEST กับ MAX ใน orders เสมอ
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
  v_max_table INTEGER;
BEGIN
  CASE LOWER(TRIM(p_order_type))
    WHEN 'grooming' THEN v_prefix := 'GRM';
    WHEN 'retail' THEN v_prefix := 'RTL';
    WHEN 'coupon' THEN v_prefix := 'CPN';
    WHEN 'membership' THEN v_prefix := 'MEM';
    ELSE RAISE EXCEPTION 'Invalid order type: %', p_order_type;
  END CASE;

  v_ym := to_char(timezone('Asia/Bangkok', now()), 'YYYYMM');
  v_key := v_prefix || '-' || v_ym;

  SELECT COALESCE(MAX(SUBSTRING(order_number FROM '\d+$')::INTEGER), 0)
  INTO v_max_table
  FROM public.orders
  WHERE order_number LIKE v_key || '-%';

  IF NOT EXISTS (SELECT 1 FROM public.order_sequences WHERE prefix = v_key) THEN
    INSERT INTO public.order_sequences (prefix, last_val, updated_at)
    VALUES (v_key, v_max_table + 1, now())
    ON CONFLICT (prefix)
    DO UPDATE SET
      last_val = GREATEST(public.order_sequences.last_val, v_max_table) + 1,
      updated_at = now()
    RETURNING last_val INTO v_seq;
  ELSE
    UPDATE public.order_sequences
    SET 
      last_val = GREATEST(last_val, v_max_table) + 1,
      updated_at = now()
    WHERE prefix = v_key
    RETURNING last_val INTO v_seq;
  END IF;

  RETURN v_key || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_order_number(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_member_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_coupon_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_pet_code() TO anon, authenticated, service_role;
