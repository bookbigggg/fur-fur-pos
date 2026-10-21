"use server";

import { createClient } from "@/lib/supabase/server";
import { 
  CouponWithDetails, 
  CouponSummaryKPI, 
  CouponTransaction 
} from "@/types/database";

export async function getCouponsSummary(): Promise<{
  success: boolean;
  coupons: CouponWithDetails[];
  kpi: CouponSummaryKPI;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. ดึงคูปองทั้งหมดพร้อมข้อมูลสัตว์เลี้ยงและลูกค้า
    const { data: couponsData, error: couponsError } = await supabase
      .from("coupons")
      .select(`
        *,
        pet:pets (
          id,
          name,
          species,
          breed,
          weight_kg,
          customer:customers (
            id,
            name,
            phone
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (couponsError) {
      console.error("Error fetching coupons:", couponsError);
      return {
        success: false,
        coupons: [],
        kpi: {
          totalCoupons: 0,
          activeCount: 0,
          exhaustedCount: 0,
          totalRemainingCredit: 0,
          totalPaidAmount: 0,
          totalPackageValue: 0,
          totalLiability: 0,
          totalUsedCredit: 0,
        },
        error: couponsError.message,
      };
    }

    // 2. ดึงจำนวน transactions ของแต่ละคูปอง
    const { data: txCounts } = await supabase
      .from("coupon_transactions")
      .select("coupon_id");

    const txCountMap = new Map<string, number>();
    if (txCounts) {
      for (const item of txCounts) {
        if (item.coupon_id) {
          txCountMap.set(item.coupon_id, (txCountMap.get(item.coupon_id) || 0) + 1);
        }
      }
    }

    const rawCoupons = (couponsData as unknown as CouponWithDetails[]) || [];
    const coupons: CouponWithDetails[] = rawCoupons.map((c) => ({
      ...c,
      transaction_count: txCountMap.get(c.id) || 0,
    }));

    // 3. คำนวณ KPI สรุปภาพรวม
    let activeCount = 0;
    let exhaustedCount = 0;
    let totalRemainingCredit = 0;
    let totalPaidAmount = 0;
    let totalPackageValue = 0;
    let totalLiability = 0;
    let totalUsedCredit = 0;

    for (const c of coupons) {
      const rem = Number(c.remaining_balance) || 0;
      const paid = Number(c.paid_amount) || 0;
      const pkg = Number(c.package_value) || 0;
      const ratio = pkg > 0 ? paid / pkg : 1;

      totalPaidAmount += paid;
      totalPackageValue += pkg;
      totalUsedCredit += Math.max(0, pkg - rem);

      if (c.status === "ใช้งานได้" && rem > 0) {
        activeCount += 1;
        totalRemainingCredit += rem;
        totalLiability += rem * ratio;
      } else {
        exhaustedCount += 1;
      }
    }

    const kpi: CouponSummaryKPI = {
      totalCoupons: coupons.length,
      activeCount,
      exhaustedCount,
      totalRemainingCredit: Number(totalRemainingCredit.toFixed(2)),
      totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
      totalPackageValue: Number(totalPackageValue.toFixed(2)),
      totalLiability: Number(totalLiability.toFixed(2)),
      totalUsedCredit: Number(totalUsedCredit.toFixed(2)),
    };

    return {
      success: true,
      coupons,
      kpi,
    };
  } catch (err: unknown) {
    console.error("getCouponsSummary Exception:", err);
    return {
      success: false,
      coupons: [],
      kpi: {
        totalCoupons: 0,
        activeCount: 0,
        exhaustedCount: 0,
        totalRemainingCredit: 0,
        totalPaidAmount: 0,
        totalPackageValue: 0,
        totalLiability: 0,
        totalUsedCredit: 0,
      },
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล",
    };
  }
}

export async function getCouponTransactions(couponId: string): Promise<{
  success: boolean;
  transactions: CouponTransaction[];
  error?: string;
}> {
  try {
    if (!couponId) {
      return { success: false, transactions: [], error: "Missing couponId" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("coupon_transactions")
      .select(`
        *,
        order:orders (
          id,
          order_number,
          order_date,
          service_description,
          net_paid
        )
      `)
      .eq("coupon_id", couponId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching coupon transactions:", error);
      return { success: false, transactions: [], error: error.message };
    }

    return {
      success: true,
      transactions: (data as unknown as CouponTransaction[]) || [],
    };
  } catch (err: unknown) {
    console.error("getCouponTransactions Exception:", err);
    return {
      success: false,
      transactions: [],
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
    };
  }
}
