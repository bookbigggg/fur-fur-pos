"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireSession } from "@/lib/supabase/server";
import { Expense } from "@/types/database";
import { isOrderActive, computeOrderRevenueParts, getBangkokTodayString } from "@/lib/order-utils";

export interface CreateExpenseInput {
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string;
  title: string;
  notes?: string | null;
  created_by?: string | null;
}

export interface IncomeBreakdown {
  groomingSales: number;              // รายได้บริการกรูมมิ่งที่รับรู้จริง = groomingCashSales + groomingCouponRecognized
  groomingCashSales: number;          // ส่วนที่รับเป็นเงินสด/โอนจากบริการกรูมมิ่ง
  groomingCouponRecognized: number;   // ส่วนที่ตัดจากคูปองและรับรู้เป็นรายได้จริงตาม TFRS 15
  retailGpProfit: number;             // กำไร GP จากสินค้าขายปลีก
  membershipIncome: number;           // ค่าสมัครสมาชิกรายปี 299
  couponSales: number;                // กระแสเงินสดรับล่วงหน้าจากการขายแพ็กเกจคูปอง (Unearned Revenue Cash)
  totalIncome: number;                // รายได้จากการดำเนินงานจริง = groomingSales + retailGpProfit + membershipIncome (ไม่รวมเงินขายคูปองที่ยังไม่ได้ให้บริการ)
  activeCouponsLiability: number;     // ภาระหนี้สินคูปองคงค้างทางบัญชี (Unearned Revenue Liability)
  activeCouponsCredit: number;        // เครดิตคูปองคงเหลือที่ลูกค้ายังสามารถนำมาใช้บริการได้
}

export interface CategoryExpense {
  category: string;
  amount: number;
  count: number;
}

export interface PnLSummaryResult {
  month: string;
  income: IncomeBreakdown;
  expenses: {
    totalExpenses: number;
    byCategory: CategoryExpense[];
  };
  netProfit: number;
  orderCount: number;
  expenseCount: number;
  tableReady: boolean;
}

export interface MonthlyTrendPoint {
  month: string;
  groomingCount: number;
  groomingSales: number;
  avgGroomingTicket: number;
  retailGpProfit: number;
  membershipIncome: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  weekdayOrders: number;
  weekendOrders: number;
  weekdayAvgPerDay: number;
  weekendAvgPerDay: number;
}

function getCurrentMonth(): string {
  const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  return bangkokDate.slice(0, 7); // YYYY-MM
}

function getMonthDateRange(monthStr: string): { startDate: string; endDate: string } {
  const [yearStr, mStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${monthStr}-01`;
  const endDate = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

export async function getExpenses(monthStr?: string): Promise<Expense[]> {
  const targetMonth = monthStr || getCurrentMonth();
  const { startDate, endDate } = getMonthDateRange(targetMonth);

  try {
    await requireSession(["owner", "manager"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }

    return (data as unknown as Expense[]) || [];
  } catch (err: unknown) {
    console.error("getExpenses Exception:", err);
    return [];
  }
}

export async function createExpense(
  input: CreateExpenseInput
): Promise<{ success: boolean; data?: Expense; error?: string }> {
  try {
    const session = await requireSession(["owner", "manager"]);
    const supabase = await createClient();

    if (!input.title.trim()) {
      return { success: false, error: "กรุณาระบุชื่อรายการค่าใช้จ่าย" };
    }
    if (input.amount <= 0) {
      return { success: false, error: "จำนวนเงินต้องมากกว่า 0 บาท" };
    }

    type ExpenseInsertPayload = {
      expense_date: string;
      category: string;
      amount: number;
      payment_method: string;
      title: string;
      notes: string | null;
      created_by?: string | null;
    };

    const payload: ExpenseInsertPayload = {
      expense_date: input.expense_date,
      category: input.category || "จิปาถะ/อื่นๆ",
      amount: input.amount,
      payment_method: input.payment_method || "โอนเงิน/QR",
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      created_by: session.name,
    };

    let { data, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select()
      .single();

    // กรณีตาราง expenses ใน Supabase ยังไม่มีคอลัมน์ created_by (Self-healing fallback)
    if (
      error &&
      (error.message?.includes("created_by") ||
        error.code === "PGRST204" ||
        error.message?.includes("schema cache"))
    ) {
      console.warn("Retrying expense insert without created_by:", error.message);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.created_by;

      const retryRes = await supabase
        .from("expenses")
        .insert(fallbackPayload)
        .select()
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) {
      console.error("Error creating expense:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/expenses");
    return { success: true, data: data as unknown as Expense };
  } catch (err: unknown) {
    console.error("createExpense Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย",
    };
  }
}

export async function deleteExpense(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSession(["owner", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting expense:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/expenses");
    return { success: true };
  } catch (err: unknown) {
    console.error("deleteExpense Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบรายการ",
    };
  }
}

export async function getPnLSummary(monthStr?: string): Promise<PnLSummaryResult> {
  const targetMonth = monthStr || getCurrentMonth();
  const { startDate, endDate } = getMonthDateRange(targetMonth);

  try {
    await requireSession(["owner", "manager"]);
    const supabase = await createClient();

    // 1. ดึงข้อมูลคำสั่งซื้อ Orders ในเดือนนี้ (กรองเฉพาะบิลที่ไม่ได้ถูกยกเลิก/Void)
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_type, net_paid, shop_net_income, recognized_coupon_income, coupon_deducted, service_description, discount_text")
      .gte("order_date", startDate)
      .lte("order_date", endDate);

    if (ordersError) {
      console.error("Error fetching orders for P&L:", ordersError);
    }

    let groomingCashSales = 0;
    let groomingCouponRecognized = 0;
    let retailGpProfit = 0;
    let membershipIncome = 0;
    let couponSales = 0;

    const activeOrders = ordersData ? ordersData.filter(isOrderActive) : [];
    const orderCount = activeOrders.length;

    // ดึงข้อมูลสินค้าปลีกในรอบเพื่อแยกยอดขายปลีกและกำไร GP ออกจากค่าบริการกรูมมิ่งอย่างแม่นยำ (รองรับบิลรวม Grooming+Retail)
    const activeOrderIds = activeOrders.map((o) => o.id);
    const retailItemsMap = new Map<string, { totalSales: number; shopProfit: number }>();

    if (activeOrderIds.length > 0) {
      const { data: retailItems } = await supabase
        .from("order_retail_items")
        .select("order_id, total_price, shop_profit, clearing_status")
        .in("order_id", activeOrderIds)
        .neq("clearing_status", "ยกเลิก");

      if (retailItems) {
        for (const item of retailItems) {
          const prev = retailItemsMap.get(item.order_id) || { totalSales: 0, shopProfit: 0 };
          retailItemsMap.set(item.order_id, {
            totalSales: Number((prev.totalSales + Number(item.total_price || 0)).toFixed(2)),
            shopProfit: Number((prev.shopProfit + Number(item.shop_profit || 0)).toFixed(2)),
          });
        }
      }
    }

    if (activeOrders.length > 0) {
      for (const ord of activeOrders) {
        const parts = computeOrderRevenueParts(ord, retailItemsMap.get(ord.id));
        groomingCashSales += parts.groomingCashSales;
        groomingCouponRecognized += parts.groomingCouponRecognized;
        retailGpProfit += parts.retailGpProfit;
        membershipIncome += parts.membershipIncome;
        couponSales += parts.couponSales;
      }
    }

    // รายได้ค่าบริการกรูมมิ่งรวม (เงินสดที่รับ + สัดส่วนมูลค่าคูปองที่แปลงเป็นรายได้จริง)
    const groomingSales = Number((groomingCashSales + groomingCouponRecognized).toFixed(2));

    // รายได้จากการดำเนินงานแท้จริงตาม TFRS 15 (ไม่รวมเงินรับล่วงหน้าจากการขายคูปอง)
    const totalIncome = Number((groomingSales + retailGpProfit + membershipIncome).toFixed(2));

    // 2. ดึงข้อมูลหนี้สินคูปองคงค้างทางบัญชี (Unearned Revenue Liability)
    let activeCouponsLiability = 0;
    let activeCouponsCredit = 0;
    try {
      const { data: couponsData } = await supabase
        .from("coupons")
        .select("remaining_balance, paid_amount, package_value")
        .eq("status", "ใช้งานได้")
        .gt("remaining_balance", 0);

      if (couponsData) {
        for (const c of couponsData) {
          const rem = Number(c.remaining_balance) || 0;
          const paid = Number(c.paid_amount) || 0;
          const pkg = Number(c.package_value) || 0;
          const ratio = pkg > 0 ? paid / pkg : 1;
          activeCouponsCredit += rem;
          activeCouponsLiability += rem * ratio;
        }
      }
      activeCouponsCredit = Number(activeCouponsCredit.toFixed(2));
      activeCouponsLiability = Number(activeCouponsLiability.toFixed(2));
    } catch (cErr) {
      console.error("Error fetching coupons liability:", cErr);
    }

    // 2. ดึงข้อมูลค่าใช้จ่าย Expenses ในเดือนนี้
    let expensesData: Expense[] = [];
    let tableReady = true;

    try {
      const { data, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });

      if (expError) {
        if (expError.message.includes("does not exist") || expError.message.includes("schema cache")) {
          tableReady = false;
        } else {
          console.error("Error fetching expenses for P&L:", expError);
        }
      } else {
        expensesData = (data as unknown as Expense[]) || [];
      }
    } catch {
      tableReady = false;
    }

    let totalExpenses = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();

    for (const exp of expensesData) {
      const amount = Number(exp.amount) || 0;
      totalExpenses += amount;
      const cat = exp.category || "จิปาถะ/อื่นๆ";
      const current = categoryMap.get(cat) || { amount: 0, count: 0 };
      categoryMap.set(cat, {
        amount: current.amount + amount,
        count: current.count + 1,
      });
    }

    const byCategory: CategoryExpense[] = Array.from(categoryMap.entries()).map(
      ([category, val]) => ({
        category,
        amount: val.amount,
        count: val.count,
      })
    );

    byCategory.sort((a, b) => b.amount - a.amount);

    const netProfit = Number((totalIncome - totalExpenses).toFixed(2));

    return {
      month: targetMonth,
      income: {
        groomingSales,
        groomingCashSales: Number(groomingCashSales.toFixed(2)),
        groomingCouponRecognized: Number(groomingCouponRecognized.toFixed(2)),
        retailGpProfit,
        membershipIncome,
        couponSales,
        totalIncome,
        activeCouponsLiability,
        activeCouponsCredit,
      },
      expenses: {
        totalExpenses: Number(totalExpenses.toFixed(2)),
        byCategory,
      },
      netProfit,
      orderCount,
      expenseCount: expensesData.length,
      tableReady,
    };
  } catch (err: unknown) {
    console.error("getPnLSummary Exception:", err);
    return {
      month: targetMonth,
      income: {
        groomingSales: 0,
        groomingCashSales: 0,
        groomingCouponRecognized: 0,
        retailGpProfit: 0,
        membershipIncome: 0,
        couponSales: 0,
        totalIncome: 0,
        activeCouponsLiability: 0,
        activeCouponsCredit: 0,
      },
      expenses: {
        totalExpenses: 0,
        byCategory: [],
      },
      netProfit: 0,
      orderCount: 0,
      expenseCount: 0,
      tableReady: false,
    };
  }
}

function buildMonthList(endMonth: string, count: number): string[] {
  const [yStr, mStr] = endMonth.split("-");
  const endYear = parseInt(yStr, 10);
  const endMon = parseInt(mStr, 10);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(endYear, endMon - 1 - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function countDayTypesInMonth(monthStr: string, todayStr: string): { weekdays: number; weekends: number } {
  const currentMonth = todayStr.slice(0, 7);
  if (monthStr > currentMonth) return { weekdays: 0, weekends: 0 };

  const [yStr, mStr] = monthStr.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const maxDay = monthStr === currentMonth ? Math.min(daysInMonth, parseInt(todayStr.slice(8, 10), 10)) : daysInMonth;

  let weekdays = 0;
  let weekends = 0;
  for (let d = 1; d <= maxDay; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) weekends++;
    else if (dow !== 2) weekdays++; // ร้านหยุดประจำวันอังคาร
  }
  return { weekdays, weekends };
}

function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export async function getMonthlyTrendAndDaySplit(
  endMonth?: string,
  monthsCount = 6
): Promise<MonthlyTrendPoint[]> {
  const targetEnd = endMonth || getCurrentMonth();
  const months = buildMonthList(targetEnd, monthsCount);
  const startDate = `${months[0]}-01`;
  const { endDate } = getMonthDateRange(months[months.length - 1]);

  try {
    await requireSession(["owner", "manager"]);
    const supabase = await createClient();

    const [{ data: ordersData }, { data: expensesData }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_type, order_date, net_paid, shop_net_income, recognized_coupon_income, coupon_deducted, service_description, discount_text")
        .gte("order_date", startDate)
        .lte("order_date", endDate),
      supabase
        .from("expenses")
        .select("expense_date, amount")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate),
    ]);

    const activeOrders = (ordersData || []).filter(isOrderActive);
    const activeIds = activeOrders.map((o) => o.id);
    const retailItemsMap = new Map<string, { totalSales: number; shopProfit: number }>();

    for (let i = 0; i < activeIds.length; i += 200) {
      const chunk = activeIds.slice(i, i + 200);
      const { data: retailItems } = await supabase
        .from("order_retail_items")
        .select("order_id, total_price, shop_profit, clearing_status")
        .in("order_id", chunk)
        .neq("clearing_status", "ยกเลิก");

      for (const item of retailItems || []) {
        const prev = retailItemsMap.get(item.order_id) || { totalSales: 0, shopProfit: 0 };
        retailItemsMap.set(item.order_id, {
          totalSales: prev.totalSales + Number(item.total_price || 0),
          shopProfit: prev.shopProfit + Number(item.shop_profit || 0),
        });
      }
    }

    const bucketMap = new Map<string, {
      groomingCount: number;
      groomingSales: number;
      retailGpProfit: number;
      membershipIncome: number;
      totalExpenses: number;
      weekdayOrders: number;
      weekendOrders: number;
    }>();

    for (const m of months) {
      bucketMap.set(m, {
        groomingCount: 0,
        groomingSales: 0,
        retailGpProfit: 0,
        membershipIncome: 0,
        totalExpenses: 0,
        weekdayOrders: 0,
        weekendOrders: 0,
      });
    }

    for (const ord of activeOrders) {
      const m = String(ord.order_date || "").slice(0, 7);
      const bucket = bucketMap.get(m);
      if (!bucket) continue;

      const parts = computeOrderRevenueParts(ord, retailItemsMap.get(ord.id));
      bucket.groomingSales += parts.groomingCashSales + parts.groomingCouponRecognized;
      bucket.retailGpProfit += parts.retailGpProfit;
      bucket.membershipIncome += parts.membershipIncome;

      if (ord.order_type === "grooming") {
        bucket.groomingCount += 1;
        if (ord.order_date && isWeekendDate(ord.order_date)) {
          bucket.weekendOrders += 1;
        } else {
          bucket.weekdayOrders += 1;
        }
      }
    }

    for (const exp of expensesData || []) {
      const m = String(exp.expense_date || "").slice(0, 7);
      const bucket = bucketMap.get(m);
      if (bucket) {
        bucket.totalExpenses += Number(exp.amount || 0);
      }
    }

    const todayStr = getBangkokTodayString();

    return months.map((m) => {
      const b = bucketMap.get(m)!;
      const groomingSales = Number(b.groomingSales.toFixed(2));
      const retailGpProfit = Number(b.retailGpProfit.toFixed(2));
      const membershipIncome = Number(b.membershipIncome.toFixed(2));
      const totalIncome = Number((groomingSales + retailGpProfit + membershipIncome).toFixed(2));
      const totalExpenses = Number(b.totalExpenses.toFixed(2));
      const netProfit = Number((totalIncome - totalExpenses).toFixed(2));
      const { weekdays, weekends } = countDayTypesInMonth(m, todayStr);

      return {
        month: m,
        groomingCount: b.groomingCount,
        groomingSales,
        avgGroomingTicket: b.groomingCount > 0 ? Math.round(groomingSales / b.groomingCount) : 0,
        retailGpProfit,
        membershipIncome,
        totalIncome,
        totalExpenses,
        netProfit,
        weekdayOrders: b.weekdayOrders,
        weekendOrders: b.weekendOrders,
        weekdayAvgPerDay: weekdays > 0 ? Number((b.weekdayOrders / weekdays).toFixed(1)) : 0,
        weekendAvgPerDay: weekends > 0 ? Number((b.weekendOrders / weekends).toFixed(1)) : 0,
      };
    });
  } catch (err: unknown) {
    console.error("getMonthlyTrendAndDaySplit Exception:", err);
    return [];
  }
}
