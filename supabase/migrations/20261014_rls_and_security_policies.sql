-- ============================================================================
-- Fur Fur POS: Row-Level Security (RLS) & Role-Based Access Control Policies
-- ป้องกันการรั่วไหลของข้อมูลยอดขาย, งบการเงิน P&L, ต้นทุน GP คู่ค้า, และเบอร์โทรลูกค้า
-- ============================================================================

-- ============================================================================
-- 1. เปิดใช้งาน Row Level Security (RLS) บนทุกตารางของระบบ (11 ตาราง)
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_retail_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ล้าง Policies เดิม (Clean up any old policies)
-- ============================================================================

-- Customers
DROP POLICY IF EXISTS "Authenticated users have full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Anon public access to customers" ON public.customers;

-- Pets
DROP POLICY IF EXISTS "Authenticated users have full access to pets" ON public.pets;
DROP POLICY IF EXISTS "Anon public access to pets" ON public.pets;

-- Orders
DROP POLICY IF EXISTS "Authenticated users have full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Anon public access to orders" ON public.orders;

-- Order Retail Items
DROP POLICY IF EXISTS "Authenticated users have full access to order_retail_items" ON public.order_retail_items;
DROP POLICY IF EXISTS "Anon public access to order_retail_items" ON public.order_retail_items;

-- Products
DROP POLICY IF EXISTS "Authenticated users have full access to products" ON public.products;
DROP POLICY IF EXISTS "Anon can view active products" ON public.products;

-- Coupons & Coupon Transactions
DROP POLICY IF EXISTS "Authenticated users have full access to coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated users have full access to coupon_transactions" ON public.coupon_transactions;

-- Annual Memberships
DROP POLICY IF EXISTS "Authenticated users have full access to annual_memberships" ON public.annual_memberships;

-- Daily Closings
DROP POLICY IF EXISTS "Authenticated users have full access to daily_closings" ON public.daily_closings;

-- Expenses
DROP POLICY IF EXISTS "Authenticated users have full access to expenses" ON public.expenses;

-- Order Sequences
DROP POLICY IF EXISTS "Allow all users to manage sequences" ON public.order_sequences;
DROP POLICY IF EXISTS "Authenticated and service role manage sequences" ON public.order_sequences;

-- ============================================================================
-- 3. นโยบายความปลอดภัยสำหรับผู้ใช้งานที่ผ่านการยืนยันตัวตน (Authenticated Users)
--    สิทธิ์เข้าถึงเต็มรูปแบบสำหรับระบบ POS หน้าร้าน (Cashier / Groomer / Owner)
-- ============================================================================

-- 3.1 ข้อมูลลูกค้าและสัตว์เลี้ยง (Customers & Pets)
CREATE POLICY "Authenticated users have full access to customers"
ON public.customers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to pets"
ON public.pets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.2 รายการคำสั่งซื้อและสินค้าปลีก (Orders & Order Retail Items)
CREATE POLICY "Authenticated users have full access to orders"
ON public.orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to order_retail_items"
ON public.order_retail_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.3 ข้อมูลสินค้าและสต็อก (Products)
CREATE POLICY "Authenticated users have full access to products"
ON public.products
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.4 คูปองเงินสดและประวัติการตัดยอด (Coupons & Transactions)
CREATE POLICY "Authenticated users have full access to coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users have full access to coupon_transactions"
ON public.coupon_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.5 ระบบสมาชิกรายปี 299 บาท (Annual Memberships)
CREATE POLICY "Authenticated users have full access to annual_memberships"
ON public.annual_memberships
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.6 การปิดกะและการตรวจนับเงินสด (Daily Closings)
CREATE POLICY "Authenticated users have full access to daily_closings"
ON public.daily_closings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.7 ค่าใช้จ่ายและงบกำไร-ขาดทุน (Expenses & Financials)
CREATE POLICY "Authenticated users have full access to expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3.8 ตาราง Sequential Atomic Numbering
CREATE POLICY "Authenticated and service role manage sequences"
ON public.order_sequences
FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 4. นโยบายสำหรับบุคคลภายนอก / ผู้ใช้ที่ไม่ผ่านการยืนยันตัวตน (Anon / Public)
--    - ป้องกันการเข้าถึงข้อมูลละเอียดอ่อน (Default Deny)
--    - อนุญาตเฉพาะดูรายการสินค้าที่เปิดขายอยู่ (Active Products Catalog)
-- ============================================================================

CREATE POLICY "Anon can view active products"
ON public.products
FOR SELECT
TO anon
USING (is_active = true);


-- ============================================================================
-- 5. ยืนยันสิทธิ์ SECURITY DEFINER สำหรับ Stored Functions
--    (เพื่อให้ Sequence ทำงานได้ราบรื่นแม้ผู้ใช้ทั่วไปจะไม่มีสิทธิ์แก้ตาราง sequences ตรงๆ)
-- ============================================================================

ALTER FUNCTION public.get_next_order_number(TEXT) SECURITY DEFINER;
ALTER FUNCTION public.get_next_member_code() SECURITY DEFINER;
ALTER FUNCTION public.get_next_coupon_code() SECURITY DEFINER;
ALTER FUNCTION public.get_next_pet_code() SECURITY DEFINER;


-- ============================================================================
-- 6. [คำแนะนำการสร้างบัญชีเริ่มต้นใน Supabase Auth]
--    สามารถสร้างบัญชีผู้ใช้งานผ่าน Supabase Dashboard -> Authentication -> Users -> Add User:
--
--    1. เจ้าของร้าน / ผู้จัดการ:
--       - Email: owner@furfurgrooming.com
--       - Password: (กำหนดตามต้องการ เช่น FurFurOwner2026!)
--       - Auto Confirm Email: ติ๊กเลือก (Yes)
--       - User Metadata (JSON): { "role": "owner", "display_name": "เจ้าของร้าน Fur Fur" }
--
--    2. พนักงานแคชเชียร์ / ช่างกรูมมิ่ง:
--       - Email: staff@furfurgrooming.com
--       - Password: (กำหนดตามต้องการ เช่น FurFurStaff2026!)
--       - Auto Confirm Email: ติ๊กเลือก (Yes)
--       - User Metadata (JSON): { "role": "staff", "display_name": "พนักงานหน้าร้าน" }
--
-- ============================================================================
