"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PaymentMethod } from "@/types/database";
import { 
  getNextOrderNumber, 
  getNextMemberCode, 
  getNextCouponCode 
} from "@/lib/sequences";

export interface PurchaseMembershipInput {
  customerId: string;
  petId: string;
  paymentMethod: PaymentMethod;
  orderDate?: string;
}

export interface PurchaseCouponInput {
  customerId: string;
  petId: string;
  packageValue: number; // มูลค่าที่จะได้ใช้ (เช่น 3,300)
  paidAmount: number;   // เงินที่จ่ายจริง (เช่น 3,000)
  paymentMethod: PaymentMethod;
  orderDate?: string;
}

// วันที่ปัจจุบันตามเวลาประเทศไทย (YYYY-MM-DD)
function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

// -----------------------------------------------------------------------------
// 1. ขาย / ต่ออายุสมาชิกรายปี 299 บาท (รองรับทั้งสมัครใหม่ และต่ออายุขยายเวลา)
// -----------------------------------------------------------------------------
export async function purchaseMembership(input: PurchaseMembershipInput) {
  try {
    const supabase = await createClient();
    const bangkokToday = getBangkokDate();
    const today = input.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
      ? input.orderDate
      : bangkokToday;
    const isBackdated = today !== bangkokToday;
    const targetCreatedAt = isBackdated
      ? `${today}T12:00:00+07:00`
      : new Date().toISOString();

    // 1. ตรวจสอบข้อมูลสมาชิกเดิมของสัตว์เลี้ยงตัวนี้
    const { data: existingMemberships } = await supabase
      .from("annual_memberships")
      .select("*")
      .eq("pet_id", input.petId)
      .order("expire_date", { ascending: false })
      .limit(1);

    const currentMem = existingMemberships?.[0] || null;

    // คำนวณวันหมดอายุ และสิทธิ์สมาชิก
    let isRenewal = false;
    let expireDateObj: Date;

    if (currentMem?.expire_date) {
      isRenewal = true;
      const existingExpire = new Date(currentMem.expire_date);
      const todayDate = new Date(today);

      if (existingExpire > todayDate) {
        // ต่ออายุล่วงหน้า: ขยายวันหมดอายุเพิ่ม 1 ปีจากวันหมดอายุเดิม (ลูกค้าไม่เสียสิทธิ์วันคงเหลือ)
        expireDateObj = new Date(currentMem.expire_date);
        expireDateObj.setFullYear(expireDateObj.getFullYear() + 1);
      } else {
        // สมาชิกหมดอายุแล้ว: เริ่มนับ 1 ปีนับจากวันที่ต่ออายุ (อิงตามวันที่สั่งซื้อ)
        expireDateObj = new Date(today);
        expireDateObj.setFullYear(expireDateObj.getFullYear() + 1);
      }
    } else {
      // สมัครใหม่ครั้งแรก: นับ 1 ปีนับจากวันที่สั่งซื้อ
      expireDateObj = new Date(today);
      expireDateObj.setFullYear(expireDateObj.getFullYear() + 1);
    }

    const expireDate = getBangkokDate(expireDateObj);

    // 2. รหัสสมาชิก (กรณีต่ออายุจะใช้รหัสเดิม / กรณีสมัครใหม่จะออกรหัส MB-XXXX ต่อเนื่องแบบ Atomic)
    let memberCode = currentMem?.member_code || "";
    if (!memberCode) {
      memberCode = await getNextMemberCode(supabase);
    }

    // 3. สร้าง Running Number เลขบิล: MEM-YYYYMM-XXXX (Atomic Sequence)
    const orderNumber = await getNextOrderNumber(supabase, "membership");

    const serviceDesc = isRenewal
      ? `ต่ออายุสมาชิกรายปี 299 (${memberCode})`
      : `สมัครสมาชิกรายปี 299 (${memberCode})`;

    // A. บันทึกคำสั่งซื้อลง orders (ค่าธรรมเนียมสมาชิก 299 บาท บันทึกแยกชัดเจน)
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId,
        pet_id: input.petId,
        order_type: "membership",
        service_description: serviceDesc,
        full_price: 299,
        discount_text: "0%",
        coupon_deducted: 0,
        recognized_coupon_income: 0,
        net_paid: 299,
        staff_commission: 0,
        shop_net_income: 299, // บันทึกเป็นรายรับค่าธรรมเนียมสมาชิก 100%
        payment_method: input.paymentMethod,
        order_date: today,
        created_at: targetCreatedAt,
      })
      .select("id")
      .single();

    if (orderError || !newOrder) {
      return { success: false, error: orderError?.message || "ไม่สามารถเปิดบิลสมาชิกได้" };
    }

    // B. อัปเดตสมาชิกเดิม (ถ้ามี) ให้สถานะเป็นหมดอายุ แล้วสร้างรอบสมาชิกใหม่
    if (currentMem?.id) {
      await supabase
        .from("annual_memberships")
        .update({ status: "หมดอายุ" })
        .eq("id", currentMem.id);
    }

    const { error: memError } = await supabase
      .from("annual_memberships")
      .insert({
        pet_id: input.petId,
        member_code: memberCode,
        fee: 299,
        start_date: today,
        expire_date: expireDate,
        status: "ใช้งานได้",
        payment_method: input.paymentMethod,
        created_at: targetCreatedAt,
      });

    if (memError) {
      // Rollback order
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return { success: false, error: memError.message };
    }

    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/closing");
    revalidatePath("/expenses");

    return {
      success: true,
      orderNumber,
      memberCode,
      expireDate,
      isRenewal,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

// -----------------------------------------------------------------------------
// 2. เปิดขายแพ็กเกจคูปอง (เช่น จ่าย 3,000 ได้ 3,300)
// -----------------------------------------------------------------------------
export async function purchaseCoupon(input: PurchaseCouponInput) {
  try {
    const supabase = await createClient();
    const bangkokToday = getBangkokDate();
    const today = input.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
      ? input.orderDate
      : bangkokToday;
    const isBackdated = today !== bangkokToday;
    const targetCreatedAt = isBackdated
      ? `${today}T12:00:00+07:00`
      : new Date().toISOString();

    // สร้าง Running Number เลขบิล: CPN-YYYYMM-XXXX (Atomic Sequence)
    const orderNumber = await getNextOrderNumber(supabase, "coupon");

    // รหัสคูปอง: CP-XXX (ต่อจากรหัสเดิมในร้านแบบ Atomic)
    const couponCode = await getNextCouponCode(supabase);

    // A. บันทึกคำสั่งซื้อลง orders
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId,
        pet_id: input.petId,
        order_type: "coupon",
        service_description: `ซื้อแพ็กเกจคูปอง (${couponCode}) จ่าย ฿${input.paidAmount.toLocaleString()} เครดิต ฿${input.packageValue.toLocaleString()}`,
        full_price: input.packageValue,
        discount_text: "0%",
        coupon_deducted: 0,
        recognized_coupon_income: 0,
        net_paid: input.paidAmount,
        staff_commission: 0,
        shop_net_income: input.paidAmount, // กระแสเงินสดรับเข้าวันนี้
        payment_method: input.paymentMethod,
        order_date: today,
        created_at: targetCreatedAt,
      })
      .select("id")
      .single();

    if (orderError || !newOrder) {
      return { success: false, error: orderError?.message || "ไม่สามารถเปิดบิลคูปองได้" };
    }

    // B. บันทึกลงตาราง coupons
    const { data: newCoupon, error: cpnError } = await supabase
      .from("coupons")
      .insert({
        pet_id: input.petId,
        coupon_code: couponCode,
        package_value: input.packageValue,
        paid_amount: input.paidAmount,
        remaining_balance: input.packageValue, // ยอดเริ่มต้นเต็มตามมูลค่า
        status: "ใช้งานได้",
        payment_method: input.paymentMethod,
        created_at: targetCreatedAt,
      })
      .select("id")
      .single();

    if (cpnError) {
      // Rollback order หากสร้างคูปองไม่สำเร็จ
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return { success: false, error: `บันทึกข้อมูลคูปองไม่สำเร็จ: ${cpnError.message}` };
    }

    // บันทึก Log การออกคูปองเริ่มต้นลง coupon_transactions
    if (newCoupon?.id) {
      try {
        await supabase.from("coupon_transactions").insert({
          coupon_id: newCoupon.id,
          transaction_type: "initial",
          amount: input.packageValue,
          notes: `ซื้อแพ็กเกจคูปองบิล ${orderNumber} (จ่าย ฿${input.paidAmount.toLocaleString()} ได้เครดิต ฿${input.packageValue.toLocaleString()})`,
        });
      } catch (tErr) {
        console.warn("Could not insert coupon_transactions initial log:", tErr);
      }
    }

    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/closing");
    revalidatePath("/expenses");

    return {
      success: true,
      orderNumber,
      couponCode,
      packageValue: input.packageValue,
      paidAmount: input.paidAmount,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}
