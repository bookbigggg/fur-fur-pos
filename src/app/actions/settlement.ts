"use server";

import { createClient, requireSession } from "@/lib/supabase/server";
import { OrderRetailItem } from "@/types/database";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export interface SettlementPeriodOption {
  key: string; // e.g. "2026-10"
  label: string; // e.g. "ตุลาคม 2569 (เดือนปัจจุบัน)"
  year: number;
  month: number;
  isLastMonth: boolean;
  isCurrentMonth: boolean;
  itemCount: number;
}

export interface BrandSettlementSummary {
  brandGroup: string;
  itemCount: number;
  totalQuantity: number;
  totalSales: number;
  shopProfit: number;
  remitTotal: number;
  clearingStatus: "รอเคลียร์" | "เคลียร์แล้ว";
  lastSaleDate?: string;
  clearedAt?: string | null;
}

export interface BrandSettlementDetail {
  brandGroup: string;
  statementNumber: string;
  periodKey: string;
  periodText: string;
  items: OrderRetailItem[];
  totalQuantity: number;
  totalSales: number;
  totalShopProfit: number;
  totalRemit: number;
  status: "รอเคลียร์" | "เคลียร์แล้ว";
}

export interface SettlementOverviewResult {
  currentPeriod: string;
  periodLabel: string;
  periodOptions: SettlementPeriodOption[];
  pending: BrandSettlementSummary[];
  cleared: BrandSettlementSummary[];
  activeBrands: string[]; // only brands that have sales in this period
  totalPendingRemit: number;
  totalPendingSales: number;
  totalClearedRemit: number;
}

function getMonthDateRange(periodStr: string) {
  const [yearStr, monthStr] = periodStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1 - 12

  // Start of month in Thailand (UTC+7): YYYY-MM-01T00:00:00+07:00
  const startIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00+07:00`;
  
  // End of month in Thailand: next month YYYY-MM-01T00:00:00+07:00
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const endIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`;

  return { startIso, endIso, year, month };
}

// 1. ดึงภาพรวมยอดแยกตามรอบเดือนและแบรนด์
export async function getSettlementOverview(selectedPeriod?: string): Promise<SettlementOverviewResult> {
  try {
    await requireSession(["owner", "manager"]);
  } catch {
    return {
      currentPeriod: "",
      periodLabel: "",
      periodOptions: [],
      pending: [],
      cleared: [],
      activeBrands: [],
      totalPendingRemit: 0,
      totalPendingSales: 0,
      totalClearedRemit: 0,
    };
  }

  const supabase = await createClient();

  // ดึงรายการขายสินค้าฝากขายทั้งหมดที่ยังไม่ถูกยกเลิก เพื่อคำนวณรอบเดือนและยอด
  const { data: allItems, error } = await supabase
    .from("order_retail_items")
    .select("*")
    .neq("clearing_status", "ยกเลิก")
    .order("created_at", { ascending: false });

  if (error || !allItems) {
    console.error("Error fetching settlement items:", error);
    return {
      currentPeriod: "",
      periodLabel: "",
      periodOptions: [],
      pending: [],
      cleared: [],
      activeBrands: [],
      totalPendingRemit: 0,
      totalPendingSales: 0,
      totalClearedRemit: 0,
    };
  }

  // สร้างรายการรอบเดือนย้อนหลัง 6 เดือน + เดือนปัจจุบัน
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // นับจำนวนชิ้นขายในแต่ละรอบเดือน (อิงเวลาไทย UTC+7)
  const monthItemCounts = new Map<string, number>();
  allItems.forEach((item: OrderRetailItem) => {
    if (!item.created_at) return;
    const itemDate = new Date(item.created_at);
    // แปลงเป็นปี-เดือนเวลาไทย
    const thDateStr = itemDate.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // "YYYY-MM-DD"
    const periodKey = thDateStr.substring(0, 7); // "YYYY-MM"
    monthItemCounts.set(periodKey, (monthItemCounts.get(periodKey) || 0) + 1);
  });

  // สร้าง list ของ 6 เดือนล่าสุด
  const periodKeysSet = new Set<string>();
  periodKeysSet.add(lastMonthKey);
  periodKeysSet.add(currentMonthKey);
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodKeysSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  // เพิ่มรอบเดือนที่มีข้อมูลใน DB
  monthItemCounts.forEach((_, key) => periodKeysSet.add(key));

  const sortedPeriodKeys = Array.from(periodKeysSet).sort((a, b) => b.localeCompare(a));

  const periodOptions: SettlementPeriodOption[] = sortedPeriodKeys.map((key) => {
    const [yStr, mStr] = key.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const isCurrent = key === currentMonthKey;
    const isLast = key === lastMonthKey;
    const thYear = y + 543;
    const thMonth = THAI_MONTHS[m - 1];

    let label = `${thMonth} ${thYear}`;
    if (isLast) {
      label += " (เดือนที่แล้ว - ปิดรอบแล้ว)";
    } else if (isCurrent) {
      label += " (เดือนปัจจุบัน - ระหว่างรอบ)";
    }

    return {
      key,
      label,
      year: y,
      month: m,
      isLastMonth: isLast,
      isCurrentMonth: isCurrent,
      itemCount: monthItemCounts.get(key) || 0,
    };
  });

  // กำหนด Default Period:
  // หากมีระบุมาให้ใช้ตามที่ระบุ
  // หากไม่ระบุ: ถ้าเดือนที่แล้วมียอดขาย ให้ใช้เดือนที่แล้ว (ตามคำขอ); ถ้าเดือนที่แล้วไม่มียอดแต่เดือนปัจจุบันมี ให้เริ่มที่เดือนปัจจุบัน; นอกนั้นเริ่มเดือนที่แล้ว
  let activePeriod = selectedPeriod;
  if (!activePeriod || !sortedPeriodKeys.includes(activePeriod)) {
    const lastMonthCount = monthItemCounts.get(lastMonthKey) || 0;
    const currentMonthCount = monthItemCounts.get(currentMonthKey) || 0;
    if (lastMonthCount > 0) {
      activePeriod = lastMonthKey;
    } else if (currentMonthCount > 0) {
      activePeriod = currentMonthKey;
    } else {
      activePeriod = lastMonthKey;
    }
  }

  const { startIso, endIso, year: activeYear, month: activeMonth } = getMonthDateRange(activePeriod);
  const activePeriodLabel = `${THAI_MONTHS[activeMonth - 1]} ${activeYear + 543}`;

  // กรองเฉพาะรายการที่เกิดขึ้นในรอบเดือนที่เลือก
  const periodItems = allItems.filter((item: OrderRetailItem) => {
    if (!item.created_at) return false;
    const createdAt = new Date(item.created_at).getTime();
    return createdAt >= new Date(startIso).getTime() && createdAt < new Date(endIso).getTime();
  });

  const pendingMap = new Map<string, BrandSettlementSummary>();
  const clearedMap = new Map<string, BrandSettlementSummary>();
  const activeBrandsSet = new Set<string>();

  periodItems.forEach((item: OrderRetailItem) => {
    const brand = (item.brand_group && item.brand_group.trim()) || "ทั่วไป";
    activeBrandsSet.add(brand);
    const isPending = item.clearing_status === "รอเคลียร์";
    const targetMap = isPending ? pendingMap : clearedMap;

    if (!targetMap.has(brand)) {
      targetMap.set(brand, {
        brandGroup: brand,
        itemCount: 0,
        totalQuantity: 0,
        totalSales: 0,
        shopProfit: 0,
        remitTotal: 0,
        clearingStatus: isPending ? "รอเคลียร์" : "เคลียร์แล้ว",
        lastSaleDate: item.created_at,
        clearedAt: item.cleared_at,
      });
    }

    const summary = targetMap.get(brand)!;
    summary.itemCount += 1;
    summary.totalQuantity += item.quantity;
    summary.totalSales += Number(item.total_price);
    summary.shopProfit += Number(item.shop_profit);
    summary.remitTotal += Number(item.remit_amount);
  });

  const pending = Array.from(pendingMap.values());
  const cleared = Array.from(clearedMap.values());
  const activeBrands = Array.from(activeBrandsSet).sort();

  const totalPendingRemit = pending.reduce((acc, curr) => acc + curr.remitTotal, 0);
  const totalPendingSales = pending.reduce((acc, curr) => acc + curr.totalSales, 0);
  const totalClearedRemit = cleared.reduce((acc, curr) => acc + curr.remitTotal, 0);

  return {
    currentPeriod: activePeriod,
    periodLabel: activePeriodLabel,
    periodOptions,
    pending,
    cleared,
    activeBrands,
    totalPendingRemit,
    totalPendingSales,
    totalClearedRemit,
  };
}

// 2. ดึงรายละเอียดเพื่อพิมพ์ใบสรุปยอดประจำแบรนด์ตามรอบเดือน (Export A4 PDF)
export async function getBrandSettlementDetail(
  brandName: string,
  period?: string,
  preferredStatus?: "รอเคลียร์" | "เคลียร์แล้ว" | "all"
): Promise<BrandSettlementDetail | null> {
  try {
    await requireSession(["owner", "manager"]);
  } catch {
    return null;
  }

  const supabase = await createClient();
  const decodedBrand = decodeURIComponent(brandName);

  // กำหนดรอบเดือน: ถ้าไม่ได้ส่งมา ให้ค้นหาว่าแบรนด์นี้มีบิลในเดือนไหนล่าสุด หรือใช้เดือนปัจจุบัน
  let targetPeriod = period;
  if (!targetPeriod) {
    const { data: latestItem } = await supabase
      .from("order_retail_items")
      .select("created_at")
      .eq("brand_group", decodedBrand)
      .neq("clearing_status", "ยกเลิก")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestItem?.created_at) {
      const thDateStr = new Date(latestItem.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      targetPeriod = thDateStr.substring(0, 7);
    } else {
      const now = new Date();
      targetPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const { startIso, endIso, year, month } = getMonthDateRange(targetPeriod);

  let query = supabase
    .from("order_retail_items")
    .select("*")
    .eq("brand_group", decodedBrand)
    .neq("clearing_status", "ยกเลิก")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true });

  if (preferredStatus === "รอเคลียร์") {
    query = query.eq("clearing_status", "รอเคลียร์");
  } else if (preferredStatus === "เคลียร์แล้ว") {
    query = query.eq("clearing_status", "เคลียร์แล้ว");
  }

  const { data } = await query;
  const items = (data as OrderRetailItem[]) || [];

  // หากไม่มีรายการขายสำหรับแบรนด์นี้ในรอบเดือนนี้ ให้คืนค่า null เพื่อให้หน้ารายงานแจ้งว่าไม่มีข้อมูลในรอบนี้
  if (items.length === 0) {
    return null;
  }

  const yearMonth = `${year}${String(month).padStart(2, "0")}`;
  const cleanBrand = decodedBrand.replace(/[^a-zA-Z0-9\u0E00-\u0E7F]/g, "").toUpperCase() || "GEN";
  const statementNumber = `STL-${yearMonth}-${cleanBrand}`;
  const periodText = `รอบประจำเดือน ${THAI_MONTHS[month - 1]} ${year + 543}`;

  let totalQty = 0;
  let totalSales = 0;
  let totalProfit = 0;
  let totalRemit = 0;

  const isAllCleared = items.every((i) => i.clearing_status === "เคลียร์แล้ว");
  const currentStatus: "รอเคลียร์" | "เคลียร์แล้ว" = isAllCleared ? "เคลียร์แล้ว" : "รอเคลียร์";

  items.forEach((item: OrderRetailItem) => {
    totalQty += item.quantity;
    totalSales += Number(item.total_price);
    totalProfit += Number(item.shop_profit);
    totalRemit += Number(item.remit_amount);
  });

  return {
    brandGroup: decodedBrand,
    statementNumber,
    periodKey: targetPeriod,
    periodText,
    items,
    totalQuantity: totalQty,
    totalSales,
    totalShopProfit: totalProfit,
    totalRemit,
    status: currentStatus,
  };
}

// 3. ปรับสถานะเป็น "เคลียร์แล้ว" เฉพาะรอบเดือนที่เลือก
export async function markBrandAsCleared(
  brandName: string,
  period?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSession(["owner", "manager"]);
  } catch (authErr) {
    return { success: false, error: authErr instanceof Error ? authErr.message : "สิทธิ์ไม่เพียงพอ" };
  }

  const supabase = await createClient();
  const decodedBrand = decodeURIComponent(brandName);

  let updateQuery = supabase
    .from("order_retail_items")
    .update({
      clearing_status: "เคลียร์แล้ว",
      cleared_at: new Date().toISOString(),
    })
    .eq("brand_group", decodedBrand)
    .eq("clearing_status", "รอเคลียร์");

  if (period) {
    const { startIso, endIso } = getMonthDateRange(period);
    updateQuery = updateQuery.gte("created_at", startIso).lt("created_at", endIso);
  }

  const { error } = await updateQuery;

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
