"use server";

import { createClient } from "@/lib/supabase/server";
import { 
  CouponWithDetails, 
  CouponSummaryKPI, 
  CouponTransaction,
  MembershipWithDetails,
  MembershipSummaryKPI,
  AnnualMembership
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

export async function getMembershipsSummary(): Promise<{
  success: boolean;
  memberships: MembershipWithDetails[];
  kpi: MembershipSummaryKPI;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("annual_memberships")
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
      .order("expire_date", { ascending: false });

    if (error) {
      console.error("Error fetching memberships:", error);
      return {
        success: false,
        memberships: [],
        kpi: {
          totalMemberships: 0,
          activeCount: 0,
          expiringCount: 0,
          expiredCount: 0,
          totalIncome: 0,
        },
        error: error.message,
      };
    }

    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const today = new Date(todayStr);

    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let totalIncome = 0;

    const rawList = (data as unknown as AnnualMembership[]) || [];
    const memberships: MembershipWithDetails[] = rawList.map((m) => {
      const expireDate = new Date(m.expire_date);
      const diffTime = expireDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let computed_status: MembershipWithDetails["computed_status"] = "ใช้งานได้";
      if (diffDays < 0) {
        computed_status = "หมดอายุ";
        expiredCount += 1;
      } else if (diffDays <= 30) {
        computed_status = "ใกล้หมดอายุ";
        expiringCount += 1;
      } else {
        computed_status = "ใช้งานได้";
        activeCount += 1;
      }

      totalIncome += Number(m.fee) || 0;

      return {
        ...m,
        computed_status,
        days_remaining: diffDays,
      };
    });

    const kpi: MembershipSummaryKPI = {
      totalMemberships: memberships.length,
      activeCount,
      expiringCount,
      expiredCount,
      totalIncome: Number(totalIncome.toFixed(2)),
    };

    return {
      success: true,
      memberships,
      kpi,
    };
  } catch (err: unknown) {
    console.error("getMembershipsSummary Exception:", err);
    return {
      success: false,
      memberships: [],
      kpi: {
        totalMemberships: 0,
        activeCount: 0,
        expiringCount: 0,
        expiredCount: 0,
        totalIncome: 0,
      },
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูลสมาชิก",
    };
  }
}
