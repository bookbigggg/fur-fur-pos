"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireSession } from "@/lib/supabase/server";
import { Expense } from "@/types/database";
import { isOrderActive } from "@/lib/order-utils";

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

    const payload = {
      expense_date: input.expense_date,
      category: input.category || "จิปาถะ/อื่นๆ",
      amount: input.amount,
      payment_method: input.payment_method || "โอนเงิน/QR",
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      created_by: session.name,
    };

    const { data, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select()
      .single();

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
        const netPaid = Number(ord.net_paid) || 0;
        const shopNetIncome = Number(ord.shop_net_income) || 0;
        const recognizedCoupon = Number(ord.recognized_coupon_income) || 0;
        const retailData = retailItemsMap.get(ord.id);
        const retailSalesInThisOrder = retailData?.totalSales || 0;
        const retailProfitInThisOrder = retailData?.shopProfit || 0;

        switch (ord.order_type) {
          case "grooming": {
            // ส่วนของค่าบริการกรูมมิ่งเงินสด (หักยอดขายปลีกออก หากเป็นบิลรวม)
            const groomingCash = Math.max(0, netPaid - retailSalesInThisOrder);
            groomingCashSales += groomingCash;

            if (recognizedCoupon > 0) {
              groomingCouponRecognized += recognizedCoupon;
            } else if (Number(ord.coupon_deducted) > 0) {
              // กรณีบิลเก่าที่ยังไม่มี recognized_coupon_income ให้คำนวณตามสัดส่วนคูปองมาตรฐาน 3000/3300 = 90.91%
              groomingCouponRecognized += Number((Number(ord.coupon_deducted) * (3000 / 3300)).toFixed(2));
            }

            // หากบิลกรูมมิ่งนี้มีสินค้าปลีกพ่วงมาด้วย นำกำไร GP สินค้าไปบวกเข้า retailGpProfit
            if (retailProfitInThisOrder > 0) {
              retailGpProfit += retailProfitInThisOrder;
            }
            break;
          }
          case "retail":
            // กำไร GP จากสินค้าฝากขาย
            retailGpProfit += (retailProfitInThisOrder > 0 ? retailProfitInThisOrder : shopNetIncome);
            break;
          case "membership":
            membershipIncome += netPaid;
            break;
          case "coupon":
            // กระแสเงินสดรับล่วงหน้าจากการขายคูปอง (ยังไม่ถือเป็นรายได้บริการจนกว่าจะมีการใช้บริการจริง)
            couponSales += netPaid;
            break;
          default:
            groomingCashSales += netPaid;
            break;
        }
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
