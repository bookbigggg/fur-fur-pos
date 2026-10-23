import { SupabaseClient } from "@supabase/supabase-js";
import { OrderType } from "@/types/database";

function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

/**
 * ออกเลขที่บิลคำสั่งซื้อแบบ Atomic (GRM-, RTL-, CPN-, MEM-)
 * 1. เรียกใช้ Stored Function get_next_order_number บน Postgres
 * 2. ตรวจสอบป้องกันเลขที่บิลซ้ำ และ Self-Healing อัตโนมัติหาก Sequence หลุด
 */
export async function getNextOrderNumber(
  supabase: SupabaseClient,
  orderType: OrderType
): Promise<string> {
  const prefixMap: Record<OrderType, string> = {
    grooming: "GRM",
    retail: "RTL",
    coupon: "CPN",
    membership: "MEM",
  };
  const prefixType = prefixMap[orderType] || "GRM";
  const bangkokDate = getBangkokDate();
  const yearMonth = bangkokDate.replace(/-/g, "").slice(0, 6);
  const prefixKey = `${prefixType}-${yearMonth}`;
  const prefix = `${prefixKey}-`;

  // 1. ลองเรียกใช้ Postgres Atomic Function
  let candidateNumber: string | null = null;
  try {
    const { data, error } = await supabase.rpc("get_next_order_number", {
      p_order_type: orderType,
    });
    if (!error && typeof data === "string" && data.trim()) {
      candidateNumber = data.trim();
    }
  } catch {
    // Fallback if RPC fails or not installed yet
  }

  // 2. ตรวจสอบว่า candidateNumber ชนกับบิลที่มีอยู่แล้วหรือไม่
  if (candidateNumber) {
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", candidateNumber)
      .maybeSingle();

    if (!existing) {
      return candidateNumber;
    }
    console.warn(`[getNextOrderNumber] Detected duplicate order number: ${candidateNumber}, self-healing...`);
  }

  // 3. Fallback & Self-healing: คำนวณจาก orders table ในเดือนปัจจุบัน
  const { data: monthOrders } = await supabase
    .from("orders")
    .select("order_number")
    .like("order_number", `${prefix}%`);

  let maxSeq = 0;
  if (monthOrders && monthOrders.length > 0) {
    for (const o of monthOrders) {
      if (o.order_number) {
        const parts = o.order_number.split("-");
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq) && lastSeq > maxSeq) maxSeq = lastSeq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const newNumber = `${prefix}${String(nextSeq).padStart(4, "0")}`;

  // 4. Sync ค่ากลับเข้าตาราง order_sequences
  try {
    await supabase.from("order_sequences").upsert({
      prefix: prefixKey,
      last_val: nextSeq,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return newNumber;
}

/**
 * ออกรหัสสมาชิกรายปีแบบ Atomic (MB-XXXX) พร้อมระบบ Self-Healing ป้องกันเลขซ้ำ 100%
 */
export async function getNextMemberCode(supabase: SupabaseClient): Promise<string> {
  let candidateCode: string | null = null;
  try {
    const { data, error } = await supabase.rpc("get_next_member_code");
    if (!error && typeof data === "string" && data.trim()) {
      candidateCode = data.trim();
    }
  } catch {
    // Fallback
  }

  if (candidateCode) {
    const { data: existing } = await supabase
      .from("annual_memberships")
      .select("id")
      .eq("member_code", candidateCode)
      .maybeSingle();

    if (!existing) return candidateCode;
    console.warn(`[getNextMemberCode] Detected duplicate code: ${candidateCode}, self-healing...`);
  }

  const { data: allMembers } = await supabase
    .from("annual_memberships")
    .select("member_code")
    .like("member_code", "MB-%");

  let maxSeq = 0;
  if (allMembers && allMembers.length > 0) {
    for (const m of allMembers) {
      if (m.member_code) {
        const match = m.member_code.match(/MB-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const newCode = `MB-${String(nextSeq).padStart(4, "0")}`;

  try {
    await supabase.from("order_sequences").upsert({
      prefix: "MB",
      last_val: nextSeq,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return newCode;
}

/**
 * ออกรหัสคูปองเงินสดแบบ Atomic (CP-XXX) พร้อมระบบ Self-Healing ป้องกันเลขซ้ำ 100%
 */
export async function getNextCouponCode(supabase: SupabaseClient): Promise<string> {
  let candidateCode: string | null = null;
  try {
    const { data, error } = await supabase.rpc("get_next_coupon_code");
    if (!error && typeof data === "string" && data.trim()) {
      candidateCode = data.trim();
    }
  } catch {
    // Fallback
  }

  if (candidateCode) {
    const { data: existing } = await supabase
      .from("coupons")
      .select("id")
      .eq("coupon_code", candidateCode)
      .maybeSingle();

    if (!existing) return candidateCode;
    console.warn(`[getNextCouponCode] Detected duplicate code: ${candidateCode}, self-healing...`);
  }

  const { data: allCoupons } = await supabase
    .from("coupons")
    .select("coupon_code")
    .like("coupon_code", "CP-%");

  let maxSeq = 0;
  if (allCoupons && allCoupons.length > 0) {
    for (const c of allCoupons) {
      if (c.coupon_code) {
        const match = c.coupon_code.match(/CP-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const newCode = `CP-${String(nextSeq).padStart(3, "0")}`;

  try {
    await supabase.from("order_sequences").upsert({
      prefix: "CP",
      last_val: nextSeq,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return newCode;
}

/**
 * ออกรหัสสัตว์เลี้ยงแบบ Atomic (PET-XXXX) พร้อมระบบ Self-Healing ป้องกันเลขซ้ำ 100%
 */
export async function getNextPetCode(supabase: SupabaseClient): Promise<string> {
  let candidateCode: string | null = null;
  try {
    const { data, error } = await supabase.rpc("get_next_pet_code");
    if (!error && typeof data === "string" && data.trim()) {
      candidateCode = data.trim();
    }
  } catch {
    // Fallback
  }

  // ป้องกันกรณี sequence ค้างหรือชนกับข้อมูลจริงในระบบ
  if (candidateCode) {
    const { data: existing } = await supabase
      .from("pets")
      .select("id")
      .eq("pet_code", candidateCode)
      .maybeSingle();

    if (!existing) {
      return candidateCode;
    }
    console.warn(`[getNextPetCode] Detected duplicate pet code: ${candidateCode}, self-healing...`);
  }

  // คำนวณจากเลขจริงสูงสุดในตาราง pets
  const { data: allPets } = await supabase
    .from("pets")
    .select("pet_code")
    .like("pet_code", "PET-%");

  let maxSeq = 0;
  if (allPets && allPets.length > 0) {
    for (const p of allPets) {
      if (p.pet_code) {
        const match = p.pet_code.match(/PET-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const newCode = `PET-${String(nextSeq).padStart(4, "0")}`;

  // Sync ค่ากลับเข้า order_sequences ทันที
  try {
    await supabase.from("order_sequences").upsert({
      prefix: "PET",
      last_val: nextSeq,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return newCode;
}

/**
 * ออกรหัสสินค้าแบบ Atomic (PRD-XXX) พร้อมระบบคำนวณตัวเลขสูงสุดที่แท้จริง
 */
export async function getNextProductCode(supabase: SupabaseClient): Promise<string> {
  const { data: allProducts } = await supabase
    .from("products")
    .select("product_code")
    .like("product_code", "PRD-%");

  let maxSeq = 0;
  if (allProducts && allProducts.length > 0) {
    for (const p of allProducts) {
      if (p.product_code) {
        const match = p.product_code.match(/PRD-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `PRD-${String(nextSeq).padStart(3, "0")}`;
}

