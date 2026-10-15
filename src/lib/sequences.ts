import { SupabaseClient } from "@supabase/supabase-js";
import { OrderType } from "@/types/database";

function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

/**
 * ออกเลขที่บิลคำสั่งซื้อแบบ Atomic (GRM-, RTL-, CPN-, MEM-)
 * 1. เรียกใช้ Stored Function get_next_order_number บน Postgres
 * 2. มี Graceful Fallback อัตโนมัติหากยังไม่ได้รัน SQL Migration ใน Supabase
 */
export async function getNextOrderNumber(
  supabase: SupabaseClient,
  orderType: OrderType
): Promise<string> {
  // 1. ลองเรียกใช้ Postgres Atomic Function
  try {
    const { data, error } = await supabase.rpc("get_next_order_number", {
      p_order_type: orderType,
    });
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback if RPC fails or not installed yet
  }

  // 2. Fallback: ค้นหาเลขที่ล่าสุดจาก orders table
  const prefixMap: Record<OrderType, string> = {
    grooming: "GRM",
    retail: "RTL",
    coupon: "CPN",
    membership: "MEM",
  };
  const prefixType = prefixMap[orderType] || "GRM";
  const bangkokDate = getBangkokDate();
  const yearMonth = bangkokDate.replace(/-/g, "").slice(0, 6);
  const prefix = `${prefixType}-${yearMonth}-`;

  const { data: lastOrder } = await supabase
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let seq = 1;
  if (lastOrder?.order_number) {
    const parts = lastOrder.order_number.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * ออกรหัสสมาชิกรายปีแบบ Atomic (MB-XXXX)
 */
export async function getNextMemberCode(supabase: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_next_member_code");
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback
  }

  const { data: lastMem } = await supabase
    .from("annual_memberships")
    .select("member_code")
    .like("member_code", "MB-%")
    .order("member_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (lastMem?.member_code) {
    const match = lastMem.member_code.match(/MB-(\d+)/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }
  return `MB-${String(nextSeq).padStart(4, "0")}`;
}

/**
 * ออกรหัสคูปองเงินสดแบบ Atomic (CP-XXX)
 */
export async function getNextCouponCode(supabase: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_next_coupon_code");
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback
  }

  const { data: lastCoupon } = await supabase
    .from("coupons")
    .select("coupon_code")
    .like("coupon_code", "CP-%")
    .order("coupon_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  let couponSeq = 1;
  if (lastCoupon?.coupon_code) {
    const match = lastCoupon.coupon_code.match(/CP-(\d+)/);
    if (match) couponSeq = parseInt(match[1], 10) + 1;
  }
  return `CP-${String(couponSeq).padStart(3, "0")}`;
}

/**
 * ออกรหัสสัตว์เลี้ยงแบบ Atomic (PET-XXXX)
 */
export async function getNextPetCode(supabase: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_next_pet_code");
    if (!error && typeof data === "string" && data.trim()) {
      return data.trim();
    }
  } catch {
    // Fallback
  }

  const { data: lastPet } = await supabase
    .from("pets")
    .select("pet_code")
    .like("pet_code", "PET-%")
    .order("pet_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextPetSeq = 1;
  if (lastPet?.pet_code) {
    const match = lastPet.pet_code.match(/PET-(\d+)/);
    if (match) nextPetSeq = parseInt(match[1], 10) + 1;
  }
  return `PET-${String(nextPetSeq).padStart(4, "0")}`;
}

/**
 * ออกรหัสสินค้าแบบ Atomic (PRD-XXX)
 */
export async function getNextProductCode(supabase: SupabaseClient): Promise<string> {
  const { data: lastProduct } = await supabase
    .from("products")
    .select("product_code")
    .like("product_code", "PRD-%")
    .order("product_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (lastProduct?.product_code) {
    const match = lastProduct.product_code.match(/PRD-(\d+)/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }
  return `PRD-${String(nextSeq).padStart(3, "0")}`;
}

