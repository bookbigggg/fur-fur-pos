"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DailyClosing } from "@/types/database";
import { isOrderActive } from "@/lib/order-utils";

export interface CashExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
}

export interface DailyClosingInput {
  closing_date: string;
  closed_by: string;
  total_orders_count: number;
  system_total_sales: number;
  system_cash_amount: number;
  cash_expenses?: number;
  system_cash_expenses?: number;
  system_transfer_amount: number;
  system_coupon_deducted: number;
  actual_cash_amount: number;
  opening_drawer_float?: number;
  cash_transferred_out?: number;
  notes?: string | null;
}

export interface DailyClosingOverview {
  date: string;
  isClosed: boolean;
  totalOrdersCount: number;
  systemTotalSales: number;
  systemCashAmount: number;         // ยอดขายเงินสดรับเข้า (Cash Sales In)
  systemCashExpenses: number;       // เงินสดจ่ายออก (Cash Expenses Out)
  systemNetCash: number;            // เงินสดสุทธิตามระบบ = systemCashAmount - systemCashExpenses
  systemTransferAmount: number;     // ยอดโอน / QR รับเข้า
  systemTransferExpenses: number;   // รายจ่ายโอน / QR
  systemCouponDeducted: number;     // ยอดหักคูปอง
  cashExpensesList: CashExpenseItem[];
  savedClosing: DailyClosing | null;
  tableReady: boolean;
}



function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

export async function getDailyClosingData(dateStr?: string): Promise<DailyClosingOverview> {
  const targetDate = dateStr || getBangkokDate();

  try {
    const supabase = await createClient();

    // 1. ดึงสรุปรายการ orders ประจำวัน (กรองเฉพาะบิลที่ไม่ได้ถูกยกเลิก/Void)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, net_paid, coupon_deducted, payment_method, service_description, discount_text")
      .eq("order_date", targetDate);

    if (ordersError) {
      console.error("Error fetching orders for closing:", ordersError);
    }

    let systemTotalSales = 0;
    let systemCashAmount = 0;
    let systemTransferAmount = 0;
    let systemCouponDeducted = 0;

    const activeOrders = orders ? orders.filter(isOrderActive) : [];
    const totalOrdersCount = activeOrders.length;

    if (activeOrders.length > 0) {
      for (const ord of activeOrders) {
        const netPaid = Number(ord.net_paid) || 0;
        systemTotalSales += netPaid;
        systemCouponDeducted += Number(ord.coupon_deducted) || 0;

        if (ord.payment_method === "เงินสด") {
          systemCashAmount += netPaid;
        } else if (ord.payment_method === "โอนเงิน" || ord.payment_method === "โอนเงิน/QR") {
          systemTransferAmount += netPaid;
        }
      }
    }

    // 2. ดึงรายการรายจ่ายประจำวันจากตาราง expenses เพื่อกระทบยอดเงินสดจ่ายออก
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("id, title, category, amount, payment_method")
      .eq("expense_date", targetDate);

    if (expensesError) {
      console.error("Error fetching expenses for closing:", expensesError);
    }

    let systemCashExpenses = 0;
    let systemTransferExpenses = 0;
    const cashExpensesList: CashExpenseItem[] = [];

    if (expenses && expenses.length > 0) {
      for (const exp of expenses) {
        const amt = Number(exp.amount) || 0;
        if (exp.payment_method === "เงินสด") {
          systemCashExpenses += amt;
          cashExpensesList.push({
            id: exp.id,
            title: exp.title,
            category: exp.category,
            amount: amt,
          });
        } else if (exp.payment_method === "โอนเงิน" || exp.payment_method === "โอนเงิน/QR") {
          systemTransferExpenses += amt;
        }
      }
    }

    const systemNetCash = Number((systemCashAmount - systemCashExpenses).toFixed(2));

    // 3. ตรวจสอบตาราง daily_closings ว่าปิดกะไปแล้วหรือไม่
    let savedClosing: DailyClosing | null = null;
    let tableReady = true;

    try {
      const { data: closingData, error: closingError } = await supabase
        .from("daily_closings")
        .select("*")
        .eq("closing_date", targetDate)
        .maybeSingle();

      if (closingError) {
        if (closingError.message.includes("does not exist") || closingError.message.includes("schema cache")) {
          tableReady = false;
        } else {
          console.error("Error fetching daily_closings:", closingError);
        }
      } else {
        savedClosing = (closingData as unknown as DailyClosing) || null;
      }
    } catch (dbErr: unknown) {
      console.error("daily_closings lookup exception:", dbErr);
      tableReady = false;
    }

    return {
      date: targetDate,
      isClosed: Boolean(savedClosing),
      totalOrdersCount,
      systemTotalSales,
      systemCashAmount,
      systemCashExpenses,
      systemNetCash,
      systemTransferAmount,
      systemTransferExpenses,
      systemCouponDeducted,
      cashExpensesList,
      savedClosing,
      tableReady,
    };
  } catch (err: unknown) {
    console.error("getDailyClosingData Exception:", err);
    return {
      date: targetDate,
      isClosed: false,
      totalOrdersCount: 0,
      systemTotalSales: 0,
      systemCashAmount: 0,
      systemCashExpenses: 0,
      systemNetCash: 0,
      systemTransferAmount: 0,
      systemTransferExpenses: 0,
      systemCouponDeducted: 0,
      cashExpensesList: [],
      savedClosing: null,
      tableReady: false,
    };
  }
}

export async function saveDailyClosing(
  input: DailyClosingInput
): Promise<{ success: boolean; data?: DailyClosing; error?: string }> {
  try {
    const supabase = await createClient();

    const actualCash = Number(input.actual_cash_amount) || 0;
    const systemCash = Number(input.system_cash_amount) || 0;
    const cashExpenses = Number(input.cash_expenses ?? input.system_cash_expenses) || 0;
    const openingFloat = Number(input.opening_drawer_float) || 0;
    const cashOut = Number(input.cash_transferred_out) || 0;

    // ยอดเงินสดที่ควรมีในเก๊ะ = เงินทอนตั้งต้น + ยอดขายเงินสด - เงินสดจ่ายออก
    const expectedDrawerCash = openingFloat + systemCash - cashExpenses;
    const cashDifference = Number((actualCash - expectedDrawerCash).toFixed(2));

    const payload: Record<string, unknown> = {
      closing_date: input.closing_date,
      closed_at: new Date().toISOString(),
      closed_by: input.closed_by.trim() || "ฟาริ บุญเย็น",
      total_orders_count: input.total_orders_count,
      system_total_sales: input.system_total_sales,
      system_cash_amount: systemCash,
      cash_expenses: cashExpenses,
      system_transfer_amount: input.system_transfer_amount,
      system_coupon_deducted: input.system_coupon_deducted,
      actual_cash_amount: actualCash,
      cash_difference: cashDifference,
      opening_drawer_float: openingFloat,
      cash_transferred_out: cashOut,
      notes: input.notes?.trim() || null,
      status: "ปิดกะเรียบร้อย",
    };

    let { data, error } = await supabase
      .from("daily_closings")
      .upsert(payload, { onConflict: "closing_date" })
      .select()
      .single();

    // หากยังไม่ได้รัน Migration เพิ่มคอลัมน์ cash_expenses ให้ลองบันทึกแบบไม่ส่งคอลัมน์นี้เพื่อความลื่นไหล
    if (error && (error.message.includes("cash_expenses") || error.code === "PGRST204" || error.message.includes("schema cache"))) {
      delete payload.cash_expenses;
      const retry = await supabase
        .from("daily_closings")
        .upsert(payload, { onConflict: "closing_date" })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("Error saving daily closing:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/closing");
    revalidatePath("/orders");
    revalidatePath("/pos");
    revalidatePath("/expenses");

    return { success: true, data: data as unknown as DailyClosing };
  } catch (err: unknown) {
    console.error("saveDailyClosing Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกปิดกะ",
    };
  }
}
