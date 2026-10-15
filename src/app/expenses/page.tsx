"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Calendar, 
  Banknote, 
  QrCode, 
  Loader2, 
  X, 
  Scissors, 
  ShoppingBag, 
  ShieldCheck, 
  Ticket,
  PieChart,
  ReceiptText
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { 
  getExpenses, 
  createExpense, 
  deleteExpense, 
  getPnLSummary, 
  PnLSummaryResult 
} from "@/app/actions/expenses";
import { Expense, ExpenseCategory } from "@/types/database";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "ค่าเช่าและสถานที่",
  "สาธารณูปโภค (น้ำ/ไฟ)",
  "เงินเดือนและค่าจ้าง",
  "ของใช้สิ้นเปลือง",
  "การตลาด/โฆษณา",
  "บำรุงรักษา/อุปกรณ์",
  "จิปาถะ/อื่นๆ",
];

function getCurrentMonth(): string {
  const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  return bangkokDate.slice(0, 7); // YYYY-MM
}

function getTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default function ExpensesAndPnLPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [activeTab, setActiveTab] = useState<"pnl" | "expenses">("pnl");
  const [pnlSummary, setPnlSummary] = useState<PnLSummaryResult | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formDate, setFormDate] = useState<string>(getTodayDate());
  const [formCategory, setFormCategory] = useState<string>("ของใช้สิ้นเปลือง");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("โอนเงิน/QR");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Load Data
  const loadData = useCallback(async (month: string) => {
    setLoading(true);
    const [pnlData, expData] = await Promise.all([
      getPnLSummary(month),
      getExpenses(month),
    ]);
    setPnlSummary(pnlData);
    setExpenses(expData);
    setLoading(false);
  }, []);

  // Initial Load (without synchronous setState in effect)
  useEffect(() => {
    let ignore = false;
    const month = getCurrentMonth();

    Promise.all([getPnLSummary(month), getExpenses(month)]).then(([pnlData, expData]) => {
      if (!ignore) {
        setPnlSummary(pnlData);
        setExpenses(expData);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Handle Month Change
  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    startTransition(() => {
      loadData(newMonth);
    });
  };

  // Handle Create Expense
  const handleCreateExpense = () => {
    setFormError(null);
    const amountNum = parseFloat(formAmount);

    if (!formTitle.trim()) {
      setFormError("กรุณาระบุชื่อรายการค่าใช้จ่าย");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }

    startTransition(async () => {
      const res = await createExpense({
        expense_date: formDate,
        category: formCategory,
        title: formTitle.trim(),
        amount: amountNum,
        payment_method: formPaymentMethod,
        notes: formNotes.trim() || null,
        created_by: "ผู้จัดการร้าน",
      });

      if (res.success) {
        setIsModalOpen(false);
        setFormTitle("");
        setFormAmount("");
        setFormNotes("");
        setFormDate(getTodayDate());
        loadData(selectedMonth);
      } else {
        setFormError(res.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    });
  };

  // Handle Delete Expense
  const handleDeleteExpense = (id: string, title: string) => {
    if (!confirm(`ยืนยันการลบรายการ "${title}" ใช่หรือไม่?`)) return;

    startTransition(async () => {
      const res = await deleteExpense(id);
      if (res.success) {
        loadData(selectedMonth);
      } else {
        alert(res.error || "ไม่สามารถลบรายการได้");
      }
    });
  };

  const formattedMonthText = new Date(`${selectedMonth}-01`).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-800 flex flex-col pb-[max(8rem,calc(6rem+env(safe-area-inset-bottom)))] font-sans">
      {/* Top Header */}
      <Navbar 
        subtitle="กำไร-ขาดทุน"
        onRefresh={() => loadData(selectedMonth)}
        isRefreshing={loading}
      />

      {/* Main Container */}
      <main className="p-4 max-w-xl mx-auto w-full space-y-4 flex-1">
        
        {/* Month Selector & View Switcher */}
        <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <span className="text-xs font-bold text-stone-600 whitespace-nowrap">
              {formattedMonthText}
            </span>
          </div>

            {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl gap-1 border border-stone-200/80">
            <button
              type="button"
              onClick={() => setActiveTab("pnl")}
              className={`min-h-[40px] py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                activeTab === "pnl"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-amber-600" />
              <span>สรุปกำไร-ขาดทุน</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={`min-h-[40px] py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                activeTab === "expenses"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              <ReceiptText className="w-3.5 h-3.5 text-amber-600" />
              <span>รายการค่าใช้จ่าย ({expenses.length})</span>
            </button>
          </div>
        </section>

        {/* Database Table Notice (if table not created yet) */}
        {pnlSummary && !pnlSummary.tableReady && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>ยังไม่พบตาราง expenses ใน Supabase</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              กรุณานำโค้ดในไฟล์ <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">scripts/create_expenses.sql</code> ไปกดรันใน Supabase SQL Editor เพื่อบันทึกค่าใช้จ่ายลงฐานข้อมูลจริงครับ
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: 📊 P&L Overview                                  */}
        {/* ======================================================== */}
        {activeTab === "pnl" && (
          <div className="space-y-4">
            {/* 3 Main KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Card 1: รายได้จากการดำเนินงานจริงตาม TFRS 15 */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                    รายได้จริงของร้าน
                  </span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="text-xl font-black text-emerald-900 block leading-tight">
                  ฿{(pnlSummary?.income.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-stone-400">
                  {pnlSummary?.orderCount || 0} บิลบริการในเดือนนี้ (เกณฑ์ TFRS 15)
                </span>
              </div>

              {/* Card 2: รายจ่ายดำเนินการร้าน */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">
                    ค่าใช้จ่ายร้าน
                  </span>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <span className="text-xl font-black text-rose-900 block leading-tight">
                  ฿{(pnlSummary?.expenses.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-stone-400">
                  {pnlSummary?.expenseCount || 0} รายการค่าใช้จ่าย
                </span>
              </div>
            </div>

            {/* Card 3: กำไรสุทธิแท้จริง (Net Profit) การ์ดเด่น */}
            <div className={`rounded-2xl p-5 border shadow-sm space-y-1 text-center ${
              (pnlSummary?.netProfit || 0) >= 0
                ? "bg-amber-500/10 border-amber-300 text-amber-950"
                : "bg-rose-50 border-rose-200 text-rose-950"
            }`}>
              <span className="text-xs font-bold uppercase tracking-wider block opacity-75">
                กำไรสุทธิประจำเดือน
              </span>
              <div className="text-3xl font-black tracking-tight leading-none py-1">
                ฿{(pnlSummary?.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] opacity-70">
                (รายได้จริง ฿{(pnlSummary?.income.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} - ค่าใช้จ่าย ฿{(pnlSummary?.expenses.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })})
              </p>
            </div>

            {/* โครงสร้างรายได้ (Operating Revenue Breakdown) */}
            <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center justify-between">
                <span>โครงสร้างรายได้จริงของร้าน</span>
                <span className="text-emerald-700 font-black">
                  ฿{(pnlSummary?.income.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </h3>

              <div className="divide-y divide-stone-100 text-xs">
                {/* 1. กรูมมิ่ง */}
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-stone-800">ค่าบริการ Grooming</span>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        เงินสด/โอน ฿{(pnlSummary?.income.groomingCashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} • ตัดคูปองรับรู้จริง ฿{(pnlSummary?.income.groomingCouponRecognized || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-stone-900 text-sm">
                    ฿{(pnlSummary?.income.groomingSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 2. กำไร GP สินค้าปลีก */}
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-stone-800">กำไร GP สินค้าฝากขาย</span>
                      <span className="text-[10px] text-stone-400 block mt-0.5">ส่วนแบ่งร้าน (หักเคลียร์คู่ค้าแล้ว)</span>
                    </div>
                  </div>
                  <span className="font-bold text-stone-900 text-sm">
                    ฿{(pnlSummary?.income.retailGpProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 3. สมาชิกรายปี */}
                <div className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="font-medium text-stone-800">ค่าสมัครสมาชิกรายปี 299</span>
                  </div>
                  <span className="font-bold text-stone-900 text-sm">
                    ฿{(pnlSummary?.income.membershipIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </section>

            {/* การบริหารกระแสเงินสด & หนี้สินคูปอง (TFRS 15 Unearned Revenue Disclosure) */}
            <section className="bg-gradient-to-br from-purple-50/70 via-stone-50 to-white rounded-2xl p-4 border border-purple-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-purple-700" />
                  <h3 className="text-xs font-black text-stone-900">
                    กระแสเงินสดรับล่วงหน้า & หนี้สินคูปอง (TFRS 15)
                  </h3>
                </div>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  Unearned Liability
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-stone-400 block">เงินสดรับเปิดคูปองเดือนนี้</span>
                  <span className="text-sm font-black text-purple-950 block">
                    ฿{(pnlSummary?.income.couponSales || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-stone-400 block">เงินสดเข้า (ยังไม่นับเป็นรายได้)</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-stone-200/80 space-y-0.5">
                  <span className="text-[10px] font-bold text-stone-400 block">เครดิตคงเหลือที่ลูกค้ามี</span>
                  <span className="text-sm font-black text-amber-800 block">
                    ฿{(pnlSummary?.income.activeCouponsCredit || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-stone-400 block">ยอดเครดิตใช้บริการได้</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-purple-300 bg-purple-50/30 space-y-0.5">
                  <span className="text-[10px] font-bold text-purple-800 block">หนี้สินคงค้างทางบัญชี</span>
                  <span className="text-sm font-black text-purple-900 block">
                    ฿{(pnlSummary?.income.activeCouponsLiability || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-purple-700 block">ภาระค้างส่งมอบบริการจริง</span>
                </div>
              </div>
            </section>

            {/* โครงสร้างค่าใช้จ่าย (Expense Breakdown by Category) */}
            <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center justify-between">
                <span>แจกแจงค่าใช้จ่ายร้าน (Operating Expenses)</span>
                <span className="text-rose-700 font-black">
                  ฿{(pnlSummary?.expenses.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </h3>

              {!pnlSummary?.expenses.byCategory || pnlSummary.expenses.byCategory.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400">
                  ไม่มีบันทึกค่าใช้จ่ายในเดือนนี้
                </div>
              ) : (
                <div className="divide-y divide-stone-100 text-xs">
                  {pnlSummary.expenses.byCategory.map((cat) => {
                    const percentage = pnlSummary.expenses.totalExpenses > 0
                      ? Math.round((cat.amount / pnlSummary.expenses.totalExpenses) * 100)
                      : 0;

                    return (
                      <div key={cat.category} className="py-2.5 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-stone-700">
                            {cat.category} ({cat.count} รายการ)
                          </span>
                          <span className="font-bold text-stone-900">
                            ฿{cat.amount.toLocaleString()} ({percentage}%)
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: 📝 Expenses Log & Form                            */}
        {/* ======================================================== */}
        {activeTab === "expenses" && (
          <div className="space-y-4">
            {/* Header Action: Add Expense Button */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-600">
                รายการค่าใช้จ่าย ({expenses.length} รายการ)
              </span>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>บันทึกค่าใช้จ่ายใหม่</span>
              </button>
            </div>

            {/* Expenses List */}
            {expenses.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 border border-stone-200 text-center space-y-2">
                <ReceiptText className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-xs font-bold text-stone-700">ยังไม่มีรายการค่าใช้จ่ายในเดือนนี้</p>
                <p className="text-[11px] text-stone-400">กดปุ่ม &quot;บันทึกค่าใช้จ่ายใหม่&quot; ด้านบนเพื่อเพิ่มรายการ</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-sm space-y-2 hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70 px-2 py-0.5 rounded-md">
                            {exp.category}
                          </span>
                          <span className="text-[11px] text-stone-400">
                            {exp.expense_date}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-stone-900 text-sm mt-1">
                          {exp.title}
                        </h4>
                        {exp.notes && (
                          <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                            {exp.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-base font-black text-rose-700 block">
                          -฿{Number(exp.amount).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {exp.payment_method}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                      <span>บันทึกโดย: {exp.created_by || "ผู้จัดการร้าน"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id, exp.title)}
                        className="text-stone-300 hover:text-rose-600 transition-colors p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg active:scale-95 cursor-pointer"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: เพิ่มค่าใช้จ่ายใหม่ (iOS Bottom Sheet on Mobile) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-t-[28px] sm:rounded-3xl max-w-sm w-full p-5 shadow-2xl border-t sm:border border-stone-200 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto -mt-2 mb-2 sm:hidden shrink-0" />

            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-amber-600" />
                <span>บันทึกค่าใช้จ่ายร้าน (Expense)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl font-medium">
                {formError}
              </p>
            )}

            <div className="space-y-3 text-xs">
              {/* วันที่ */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">วันที่จ่าย *</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-base sm:text-xs"
                />
              </div>

              {/* หมวดหมู่ */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">หมวดหมู่ค่าใช้จ่าย *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-base sm:text-xs"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* ชื่อรายการ */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">ชื่อรายการค่าใช้จ่าย *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="เช่น ซื้อน้ำยาทำความสะอาด, ค่าไฟเดือน 10"
                  autoCorrect="off"
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 text-base sm:text-xs"
                />
              </div>

              {/* จำนวนเงิน */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">จำนวนเงิน (บาท) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-base sm:text-sm text-stone-900"
                />
              </div>

              {/* วิธีชำระเงิน */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">วิธีจ่ายเงิน</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "โอนเงิน/QR", label: "โอนเงิน / QR", icon: QrCode },
                    { id: "เงินสด", label: "เงินสด", icon: Banknote },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFormPaymentMethod(id)}
                      className={`min-h-[44px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        formPaymentMethod === id
                          ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">หมายเหตุเพิ่มเติม</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="เช่น ใบเสร็จเลขที่..., โอนจากบัญชีร้าน..."
                  className="w-full p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500 text-base sm:text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-stone-600 font-bold border border-stone-200 hover:bg-stone-50 text-xs active:scale-95 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isPending || !formTitle.trim() || !formAmount}
                onClick={handleCreateExpense}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>บันทึกรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
