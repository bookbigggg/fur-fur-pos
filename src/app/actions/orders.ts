"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Order, Species } from "@/types/database";
import { isOrderActive } from "@/lib/order-utils";

export interface OrderCustomerSummary {
  id: string;
  name: string;
  phone?: string | null;
}

export interface OrderPetSummary {
  id: string;
  name: string;
  species: Species;
  breed?: string | null;
  weight_kg?: number | null;
}

export interface OrderRetailItemSummary {
  id: string;
  product_name: string;
  brand_group: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderSummaryItem extends Order {
  customer?: OrderCustomerSummary | null;
  pet?: OrderPetSummary | null;
  retail_items?: OrderRetailItemSummary[];
  isVoided?: boolean;
}

export interface OrderDetailResult extends OrderSummaryItem {
  retail_items?: OrderRetailItemSummary[];
}

export interface OrdersFilter {
  date?: string;
  search?: string;
  type?: string;
  status?: string;
}

export interface DailySummaryMetrics {
  totalSales: number;
  orderCount: number;
  cashTotal: number;
  transferQrTotal: number;
  couponDeductedTotal: number;
}

export interface VoidOrderInput {
  orderId: string;
  reason: string;
  voidedBy?: string;
}

export interface VoidOrderResult {
  success: boolean;
  orderNumber?: string;
  error?: string;
}

function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}



// 1. ดึงรายการคำสั่งซื้อล่าสุด (Recent Orders)
export async function getRecentOrders(filters?: OrdersFilter): Promise<OrderSummaryItem[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select(`
        *,
        customer:customers (
          id,
          name,
          phone
        ),
        pet:pets (
          id,
          name,
          species,
          breed,
          weight_kg
        ),
        retail_items:order_retail_items (
          id,
          product_name,
          brand_group,
          quantity,
          unit_price,
          total_price
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    // Filter by Date
    if (filters?.date) {
      query = query.eq("order_date", filters.date);
    }

    // Filter by Type
    if (filters?.type && filters.type !== "all") {
      if (filters.type === "package") {
        query = query.in("order_type", ["membership", "coupon"]);
      } else {
        query = query.eq("order_type", filters.type);
      }
    }

    // Filter by Search Term
    if (filters?.search && filters.search.trim().length > 0) {
      const cleanSearch = filters.search.trim();

      const { data: matchedCustomers } = await supabase
        .from("customers")
        .select("id")
        .or(`phone.ilike.%${cleanSearch}%,name.ilike.%${cleanSearch}%`);
      const customerIds = matchedCustomers?.map((c) => c.id) || [];

      const { data: matchedPets } = await supabase
        .from("pets")
        .select("id")
        .ilike("name", `%${cleanSearch}%`);
      const petIds = matchedPets?.map((p) => p.id) || [];

      const orClauses: string[] = [
        `order_number.ilike.%${cleanSearch}%`,
        `service_description.ilike.%${cleanSearch}%`,
      ];
      if (customerIds.length > 0) {
        orClauses.push(`customer_id.in.(${customerIds.join(",")})`);
      }
      if (petIds.length > 0) {
        orClauses.push(`pet_id.in.(${petIds.join(",")})`);
      }

      query = query.or(orClauses.join(","));
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching recent orders:", error);
      return [];
    }

    return ((data as unknown as OrderSummaryItem[]) || []).map((ord) => ({
      ...ord,
      isVoided: !isOrderActive(ord),
    }));
  } catch (err: unknown) {
    console.error("getRecentOrders Exception:", err);
    return [];
  }
}

// 2. ดึงรายละเอียดคำสั่งซื้อเดี่ยวเพื่อพิมพ์สลิปหรือตรวจสอบ
export async function getOrderDetail(orderId: string): Promise<OrderDetailResult | null> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("orders")
      .select(`
        *,
        customer:customers (
          id,
          name,
          phone
        ),
        pet:pets (
          id,
          name,
          species,
          breed,
          weight_kg
        ),
        retail_items:order_retail_items (
          id,
          product_name,
          brand_group,
          quantity,
          unit_price,
          total_price
        )
      `);

    // Match either by UUID id or order_number
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (!isUuid) {
      query = query.eq("order_number", orderId);
    } else {
      query = query.eq("id", orderId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching order detail:", error);
      return null;
    }

    const ord = data as unknown as OrderDetailResult;
    if (!ord) return null;

    return {
      ...ord,
      isVoided: !isOrderActive(ord),
    };
  } catch (err: unknown) {
    console.error("getOrderDetail Exception:", err);
    return null;
  }
}

// 3. สรุปยอดขายประจำวัน (ไม่รวมบิลที่ถูก Void)
export async function getDailySummary(dateStr?: string): Promise<DailySummaryMetrics> {
  try {
    const supabase = await createClient();
    const targetDate = dateStr || getBangkokDate();

    const { data, error } = await supabase
      .from("orders")
      .select("net_paid, coupon_deducted, payment_method, service_description, discount_text")
      .eq("order_date", targetDate);

    if (error) {
      console.error("getDailySummary Query Error:", error);
      return {
        totalSales: 0,
        orderCount: 0,
        cashTotal: 0,
        transferQrTotal: 0,
        couponDeductedTotal: 0,
      };
    }

    if (!data) {
      return {
        totalSales: 0,
        orderCount: 0,
        cashTotal: 0,
        transferQrTotal: 0,
        couponDeductedTotal: 0,
      };
    }

    let totalSales = 0;
    let cashTotal = 0;
    let transferQrTotal = 0;
    let couponDeductedTotal = 0;
    let activeOrderCount = 0;

    for (const item of data) {
      // ข้ามบิลที่ถูกยกเลิก (Voided)
      if (!isOrderActive(item)) continue;

      activeOrderCount += 1;
      const netPaid = Number(item.net_paid) || 0;
      totalSales += netPaid;
      couponDeductedTotal += Number(item.coupon_deducted) || 0;

      if (item.payment_method === "เงินสด") {
        cashTotal += netPaid;
      } else if (item.payment_method === "โอนเงิน" || item.payment_method === "โอนเงิน/QR") {
        transferQrTotal += netPaid;
      }
    }

    return {
      totalSales: Number(totalSales.toFixed(2)),
      orderCount: activeOrderCount,
      cashTotal: Number(cashTotal.toFixed(2)),
      transferQrTotal: Number(transferQrTotal.toFixed(2)),
      couponDeductedTotal: Number(couponDeductedTotal.toFixed(2)),
    };
  } catch (err: unknown) {
    console.error("getDailySummary Exception:", err);
    return {
      totalSales: 0,
      orderCount: 0,
      cashTotal: 0,
      transferQrTotal: 0,
      couponDeductedTotal: 0,
    };
  }
}

// 4. ระบบ Void บิล / ยกเลิกคำสั่งซื้อ (Rollback คูปอง, สมาชิก, สินค้าฝากขาย)
export async function voidOrder(input: VoidOrderInput): Promise<VoidOrderResult> {
  try {
    const supabase = await createClient();

    if (!input.orderId) {
      return { success: false, error: "ไม่พบรหัสคำสั่งซื้อที่ต้องการยกเลิก" };
    }
    const cleanReason = input.reason?.trim() || "คีย์ข้อมูลผิดพลาด";
    const voidedBy = input.voidedBy?.trim() || "แคชเชียร์";

    // 1. ดึงข้อมูลคำสั่งซื้อเดิม
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", input.orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: "ไม่พบบิลคำสั่งซื้อในระบบ" };
    }

    // 2. ตรวจสอบว่าบิลนี้ถูกยกเลิกไปแล้วหรือไม่
    if (!isOrderActive(order)) {
      return { success: false, error: `บิล ${order.order_number} ถูกยกเลิกไปแล้วก่อนหน้านี้` };
    }

    // 3. Rollback สิทธิ์และยอดเงินตามประเภทคำสั่งซื้อ (order_type)
    if (order.order_type === "grooming") {
      // หากมีการหักยอดคูปอง ให้โอนยอดเงินคืนกลับเข้าคูปองของลูกค้าทันที
      if (order.coupon_id && Number(order.coupon_deducted) > 0) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("id, remaining_balance, status")
          .eq("id", order.coupon_id)
          .single();

        if (coupon) {
          const restoredBalance = Number((Number(coupon.remaining_balance) + Number(order.coupon_deducted)).toFixed(2));
          await supabase
            .from("coupons")
            .update({
              remaining_balance: restoredBalance,
              status: "ใช้งานได้",
              updated_at: new Date().toISOString(),
            })
            .eq("id", coupon.id);

          // บันทึก Log การคืนยอดคูปองลง coupon_transactions (ถ้ามีตาราง)
          try {
            await supabase.from("coupon_transactions").insert({
              coupon_id: coupon.id,
              transaction_type: "refund",
              amount: Number(order.coupon_deducted),
              notes: `คืนยอดคูปองจากการยกเลิกบิล ${order.order_number} (${cleanReason})`,
            });
          } catch (tErr) {
            console.warn("Could not insert coupon_transactions log:", tErr);
          }
        }
      }
    } else if (order.order_type === "membership") {
      // หากเป็นบิลซื้อสมาชิกรายปี 299 ให้ปรับสถานะสมาชิกรอบนั้นเป็น "หมดอายุ"
      if (order.pet_id) {
        // ค้นหา member_code จาก service_description (เช่น MB-0001) ถ้ามี
        const codeMatch = order.service_description?.match(/MB-\d+/);
        let memQuery = supabase
          .from("annual_memberships")
          .select("id, created_at, member_code")
          .eq("pet_id", order.pet_id);

        if (codeMatch && codeMatch[0]) {
          memQuery = memQuery.eq("member_code", codeMatch[0]);
        }

        const { data: memberships } = await memQuery
          .order("created_at", { ascending: false })
          .limit(1);

        if (memberships && memberships.length > 0) {
          await supabase
            .from("annual_memberships")
            .update({
              status: "หมดอายุ",
              updated_at: new Date().toISOString(),
            })
            .eq("id", memberships[0].id);
        }
      }
    } else if (order.order_type === "coupon") {
      // หากเป็นบิลซื้อแพ็กเกจคูปองเงินสด ให้ตรวจสอบและปรับสถานะคูปองนั้นเป็น "ยกเลิก"
      if (order.pet_id) {
        const codeMatch = order.service_description?.match(/CP-\d+/);
        let cpnQuery = supabase
          .from("coupons")
          .select("id, coupon_code, package_value, remaining_balance, status")
          .eq("pet_id", order.pet_id);

        if (codeMatch && codeMatch[0]) {
          cpnQuery = cpnQuery.eq("coupon_code", codeMatch[0]);
        }

        const { data: coupons } = await cpnQuery
          .order("created_at", { ascending: false })
          .limit(1);

        if (coupons && coupons.length > 0) {
          const targetCoupon = coupons[0];
          // ป้องกันความผิดพลาดทางการเงิน: หากคูปองถูกนำไปตัดใช้แล้ว ไม่อนุญาตให้ Void บิลซื้อคูปอง
          if (Number(targetCoupon.remaining_balance) < Number(targetCoupon.package_value)) {
            return {
              success: false,
              error: `ไม่สามารถยกเลิกบิลนี้ได้ เนื่องจากคูปอง ${targetCoupon.coupon_code} มีการนำไปตัดใช้บริการแล้ว (คงเหลือ ฿${Number(targetCoupon.remaining_balance).toLocaleString()} จาก ฿${Number(targetCoupon.package_value).toLocaleString()})`,
            };
          }

          await supabase
            .from("coupons")
            .update({
              status: "ยกเลิก",
              remaining_balance: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetCoupon.id);

          // บันทึก Log การยกเลิกคูปองลง coupon_transactions
          try {
            await supabase.from("coupon_transactions").insert({
              coupon_id: targetCoupon.id,
              transaction_type: "refund",
              amount: Number(targetCoupon.package_value),
              notes: `ยกเลิกคูปองจากการ Void บิลซื้อ ${order.order_number} (${cleanReason})`,
            });
          } catch (tErr) {
            console.warn("Could not insert coupon cancel log:", tErr);
          }
        }
      }
    }

    // ตรวจสอบและยกเลิกรายการสินค้าปลีกใน order_retail_items (ถ้ามี) เพื่อไม่ให้นำไปคิดในรอบเคลียร์เงินคู่ค้า
    await supabase
      .from("order_retail_items")
      .update({
        clearing_status: "ยกเลิก",
      })
      .eq("order_id", order.id);

    // 4. บันทึกยกเลิกบิลในตาราง orders
    const voidTime = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status: "voided",
      void_reason: cleanReason,
      voided_at: voidTime,
      voided_by: voidedBy,
      service_description: order.service_description?.startsWith("[VOID]")
        ? order.service_description
        : `[VOID: ${cleanReason}] ${order.service_description || ""}`.trim(),
      updated_at: voidTime,
    };

    let { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    // Fallback: หากยังไม่ได้รัน Migration เพิ่มคอลัมน์ status ให้บันทึกลงใน service_description และ discount_text
    if (updateError && (updateError.message.includes("status") || updateError.message.includes("void") || updateError.code === "PGRST204")) {
      const fallbackPayload = {
        service_description: `[VOID: ${cleanReason}] ${order.service_description || ""}`.trim(),
        discount_text: "[VOID]",
        updated_at: voidTime,
      };
      const retry = await supabase.from("orders").update(fallbackPayload).eq("id", order.id);
      updateError = retry.error;
    }

    if (updateError) {
      console.error("Order Void Update Error:", updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath("/orders");
    revalidatePath("/pos");
    revalidatePath("/closing");
    revalidatePath("/expenses");
    revalidatePath("/settlement");
    revalidatePath("/coupons");

    return { success: true, orderNumber: order.order_number };
  } catch (err: unknown) {
    console.error("voidOrder Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการยกเลิกบิล",
    };
  }
}
