"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  Calendar, 
  Banknote, 
  QrCode, 
  Printer, 
  Loader2, 
  Save, 
  AlertCircle, 
  HelpCircle, 
  Clock,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  ReceiptText,
  Sparkles
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { 
  getDailyClosingData, 
  saveDailyClosing, 
  DailyClosingOverview 
} from "@/app/actions/daily-closing";
import ClosingReceiptModal from "@/components/closing/ClosingReceiptModal";

function getBangkokDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);
}

export default function DailyClosingPage() {
  const [selectedDate, setSelectedDate] = useState<string>(getBangkokDate());
  const [overview, setOverview] = useState<DailyClosingOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Form Inputs
  const [actualCashInput, setActualCashInput] = useState<string>("0");
  const [openingFloatInput, setOpeningFloatInput] = useState<string>("0");
  const [cashOutInput, setCashOutInput] = useState<string>("0");
  const [closedBy, setClosedBy] = useState<string>("ฟาริ บุญเย็น");
  const [notes, setNotes] = useState<string>("");

  // Feedback State
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [showExpenseList, setShowExpenseList] = useState<boolean>(true);

  // Load data without synchronous setState in effect
  const loadData = useCallback(async (date: string) => {
    setLoading(true);
    setFeedbackMessage(null);
    const data = await getDailyClosingData(date);
    setOverview(data);

    if (data.savedClosing) {
      setActualCashInput(data.savedClosing.actual_cash_amount.toString());
      setOpeningFloatInput((data.savedClosing.opening_drawer_float ?? 0).toString());
      setCashOutInput((data.savedClosing.cash_transferred_out ?? 0).toString());
      setClosedBy(data.savedClosing.closed_by);
      setNotes(data.savedClosing.notes || "");
    } else {
      // Default actual cash to system net cash (Sales Cash - Cash Expenses) when closing for the first time
      const defaultCash = data.systemNetCash > 0 ? data.systemNetCash : 0;
      setActualCashInput(defaultCash.toString());
      setOpeningFloatInput("0");
      setCashOutInput("0");
      setNotes("");
    }

    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    const today = getBangkokDate();

    getDailyClosingData(today).then((data) => {
      if (!ignore) {
        setOverview(data);
        if (data.savedClosing) {
          setActualCashInput(data.savedClosing.actual_cash_amount.toString());
          setOpeningFloatInput((data.savedClosing.opening_drawer_float ?? 0).toString());
          setCashOutInput((data.savedClosing.cash_transferred_out ?? 0).toString());
          setClosedBy(data.savedClosing.closed_by);
          setNotes(data.savedClosing.notes || "");
        } else {
          const defaultCash = data.systemNetCash > 0 ? data.systemNetCash : 0;
          setActualCashInput(defaultCash.toString());
          setOpeningFloatInput("0");
          setCashOutInput("0");
          setNotes("");
        }
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Handle Date Change
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    startTransition(() => {
      loadData(newDate);
    });
  };

  // Real-time Calculations
  const actualCash = parseFloat(actualCashInput) || 0;
  const openingFloat = parseFloat(openingFloatInput) || 0;
  const cashOut = parseFloat(cashOutInput) || 0;

  const cashSales = overview?.systemCashAmount || 0;
  const cashExpenses = overview?.systemCashExpenses || 0;
  const systemNetCash = overview?.systemNetCash ?? (cashSales - cashExpenses);

  // Expected cash in drawer = Opening Float + Cash Sales - Cash Expenses
  const expectedDrawerCash = openingFloat + cashSales - cashExpenses;
  const cashDifference = actualCash - expectedDrawerCash;
  const remainingFloatAfterCashOut = actualCash - cashOut;

  // Submit Handler
  const handleSubmitClosing = () => {
    if (!overview) return;
    setFeedbackMessage(null);

    startTransition(async () => {
      const res = await saveDailyClosing({
        closing_date: selectedDate,
        closed_by: closedBy.trim() || "ฟาริ บุญเย็น",
        total_orders_count: overview.totalOrdersCount,
        system_total_sales: overview.systemTotalSales,
        system_cash_amount: overview.systemCashAmount,
        cash_expenses: overview.systemCashExpenses,
        system_cash_expenses: overview.systemCashExpenses,
        system_transfer_amount: overview.systemTransferAmount,
        system_coupon_deducted: overview.systemCouponDeducted,
        actual_cash_amount: actualCash,
        opening_drawer_float: openingFloat,
        cash_transferred_out: cashOut,
        notes: notes.trim(),
      });

      if (res.success && res.data) {
        setFeedbackMessage({
          type: "success",
          text: `บันทึกปิดกะรอบวันที่ ${selectedDate} เรียบร้อยแล้ว`,
        });
        loadData(selectedDate);
      } else {
        setFeedbackMessage({
          type: "error",
          text: res.error || "ไม่สามารถบันทึกปิดกะได้ กรุณาลองใหม่",
        });
      }
    });
  };

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-800 flex flex-col pb-[max(8rem,calc(6rem+env(safe-area-inset-bottom)))] font-sans">
      {/* Top Navbar */}
      <Navbar 
        subtitle="ปิดกะ & นับเงินสด"
        onRefresh={() => loadData(selectedDate)}
        isRefreshing={loading}
      />

      {/* Main Content */}
      <main className="p-4 max-w-xl mx-auto w-full space-y-4 flex-1">
        
        {/* Date Selector & Closing Status Banner */}
        <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              />
            </div>

            {/* Status Badge */}
            {overview?.isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ปิดกะเรียบร้อยแล้ว
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                ยังไม่ได้ปิดกะ
              </span>
            )}
          </div>

          {overview?.savedClosing && (
            <p className="text-[11px] text-stone-500 pt-1 border-t border-stone-100">
              บันทึกล่าสุดเมื่อ{" "}
              {new Date(overview.savedClosing.closed_at).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              น. โดย <span className="font-semibold text-stone-700">{overview.savedClosing.closed_by}</span>
            </p>
          )}
        </section>

        {/* Database Table Notice (if table not created yet) */}
        {overview && !overview.tableReady && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>ยังไม่พบตาราง daily_closings ใน Supabase</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              กรุณานำโค้ดในไฟล์ <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">scripts/create_daily_closings.sql</code> ไปกดรันใน Supabase SQL Editor เพื่อเปิดใช้งานการบันทึกฐานข้อมูลถาวรครับ
            </p>
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* 1. แผงสรุปยอดตามระบบ (System Overview) */}
        <section className="space-y-2.5">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. สรุปยอดขาย & กระแสเงินสดตามระบบ</span>
            </h2>
            <span className="text-[11px] text-stone-500 font-medium">
              เปิด {overview?.totalOrdersCount || 0} บิล
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* กล่องที่ 1: ยอดขายรวมสุทธิ */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-stone-400 block uppercase">
                ยอดขายรวมสุทธิ
              </span>
              <span className="text-xl font-black text-stone-900 block leading-tight">
                ฿{(overview?.systemTotalSales || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-stone-400">เงินเข้าหน้าร้านทั้งหมด</span>
            </div>

            {/* กล่องที่ 2: ยอดรับโอนเงิน / QR */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-700 uppercase">
                  ยอดโอน / QR Code
                </span>
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xl font-black text-blue-900 block leading-tight">
                ฿{(overview?.systemTransferAmount || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-stone-400">เทียบยอดใน App ธนาคาร</span>
            </div>

            {/* กล่องที่ 3: ยอดขายเงินสดรับเข้า */}
            <div className="bg-white rounded-2xl p-4 border border-amber-300 bg-amber-50/30 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 uppercase">
                  ยอดขายเงินสดรับเข้า
                </span>
                <Banknote className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <span className="text-xl font-black text-amber-900 block leading-tight">
                ฿{cashSales.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-700">เงินสดจากบิลคำสั่งซื้อ</span>
            </div>

            {/* กล่องที่ 4: เงินสดจ่ายออก (Cash Expenses) */}
            <div className={`rounded-2xl p-4 border shadow-sm space-y-1 ${
              cashExpenses > 0 
                ? "bg-rose-50/50 border-rose-200 text-rose-950" 
                : "bg-white border-stone-200/90 text-stone-800"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase ${
                  cashExpenses > 0 ? "text-rose-700" : "text-stone-400"
                }`}>
                  เงินสดจ่ายออก (Expenses)
                </span>
                <TrendingDown className={`w-3.5 h-3.5 ${
                  cashExpenses > 0 ? "text-rose-600" : "text-stone-400"
                }`} />
              </div>
              <span className={`text-xl font-black block leading-tight ${
                cashExpenses > 0 ? "text-rose-700" : "text-stone-400"
              }`}>
                {cashExpenses > 0 ? `-฿${cashExpenses.toLocaleString()}` : "฿0"}
              </span>
              <span className={`text-[10px] ${cashExpenses > 0 ? "text-rose-600" : "text-stone-400"}`}>
                {overview?.cashExpensesList.length || 0} รายการค่าใช้จ่ายเงินสด
              </span>
            </div>
          </div>

          {/* แถบสรุป ยอดเงินสดสุทธิตามระบบ (Net Cash Calculation) */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>เงินสดสุทธิตามระบบ (Net Cash Flow)</span>
              </div>
              <p className="text-[11px] text-stone-500">
                ยอดขายเงินสด ฿{cashSales.toLocaleString()} − เงินสดจ่ายออก ฿{cashExpenses.toLocaleString()}
              </p>
            </div>

            <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between">
              <span className="text-[10px] text-stone-400 sm:hidden">สุทธิตามระบบ:</span>
              <span className="text-lg font-black text-amber-900">
                ฿{systemNetCash.toLocaleString()}
              </span>
            </div>
          </div>

          {/* รายละเอียดรายการเงินสดจ่ายออก (ถ้ามี) */}
          {overview?.cashExpensesList && overview.cashExpensesList.length > 0 ? (
            <div className="bg-rose-50/40 rounded-2xl p-3.5 border border-rose-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowExpenseList(!showExpenseList)}
                  className="font-bold text-rose-900 flex items-center gap-1.5 hover:underline cursor-pointer"
                >
                  <ReceiptText className="w-3.5 h-3.5 text-rose-700" />
                  <span>รายการเงินสดจ่ายออกวันนี้ ({overview.cashExpensesList.length} รายการ)</span>
                  <span className="text-[10px] text-rose-600 font-normal">
                    {showExpenseList ? "(ซ่อน)" : "(แสดง)"}
                  </span>
                </button>
                <Link
                  href="/expenses"
                  className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-0.5 hover:underline"
                >
                  <span>จัดการรายจ่าย</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {showExpenseList && (
                <div className="divide-y divide-rose-100 pt-1">
                  {overview.cashExpensesList.map((item) => (
                    <div key={item.id} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="font-semibold text-stone-800">{item.title}</span>
                        <span className="text-[10px] text-rose-700/80 block">หมวด: {item.category}</span>
                      </div>
                      <span className="font-bold text-rose-700">-฿{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-stone-50 rounded-2xl px-3.5 py-2.5 border border-stone-200/70 flex items-center justify-between text-xs text-stone-500">
              <span className="text-[11px]">ไม่มีรายการเงินสดจ่ายออกในวันนี้</span>
              <Link
                href="/expenses"
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <span>+ บันทึกรายจ่าย</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </section>

        {/* 2. เครื่องมือนับเงินสดในลิ้นชัก (Cash Reconciliation Section) */}
        <section className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h2 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-amber-600" />
              <span>2. ตรวจนับเงินสดในลิ้นชัก (Cash Count & Reconciliation)</span>
            </h2>
            <span className="text-[10px] text-stone-400">นับยอดเงินสดจริง</span>
          </div>

          {/* สเต็ปที่ 1: เงินทอนตั้งต้น (Opening Float) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-stone-700 block">
                เงินทอนตั้งต้น (Opening Float)
              </label>
              <span className="text-[10px] text-stone-400">เงินเก็บติดเก๊ะไว้ทอนตอนเช้า</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                ฿
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                placeholder="0"
                className="w-full min-h-[44px] text-base font-bold pl-8 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white text-stone-900"
              />
            </div>
          </div>

          {/* สเต็ปที่ 2: ยอดเงินสดที่นับได้จริงในเก๊ะ */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-900 block">
                ยอดเงินสดที่นับได้จริงในเก๊ะ (บาท) *
              </label>
              <span className="text-[10px] text-stone-500">นับทั้งธนบัตรและเหรียญ</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-lg">
                ฿
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="0"
                className="w-full min-h-[48px] text-2xl font-black pl-8 pr-4 py-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-amber-50/20 text-stone-950"
              />
            </div>
          </div>

          {/* สเต็ปที่ 3: ตารางกระทบยอดเงินสด Real-time */}
          <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 space-y-2.5">
            <span className="text-[10px] font-bold text-stone-500 uppercase block tracking-wider">
              สมการกระทบยอดเงินสด (Reconciliation Breakdown)
            </span>

            <div className="space-y-1.5 text-xs text-stone-600 font-medium">
              <div className="flex justify-between">
                <span>เงินทอนตั้งต้น (Opening Float):</span>
                <span>฿{openingFloat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-700">
                <span>(+) ยอดขายเงินสดตามระบบ:</span>
                <span className="font-bold text-stone-900">+฿{cashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>(-) หัก เงินสดจ่ายออก:</span>
                <span className="font-bold">-฿{cashExpenses.toLocaleString()}</span>
              </div>
              <div className="pt-1.5 border-t border-stone-200 flex justify-between font-bold text-stone-800">
                <span>(=) ยอดเงินสดที่ควรมีในเก๊ะ (Expected):</span>
                <span className="text-amber-900 font-extrabold text-sm">
                  ฿{expectedDrawerCash.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-bold text-stone-800">
                <span>(➔) เงินสดที่นับได้จริง (Actual):</span>
                <span className="text-stone-950 font-extrabold text-sm">
                  ฿{actualCash.toLocaleString()}
                </span>
              </div>
            </div>

            {/* แถบผลต่างเงินสด (Badge) */}
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">ผลต่างเงินสด:</span>

              {cashDifference === 0 ? (
                <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>เงินสดตรงเป๊ะ (฿0)</span>
                </span>
              ) : cashDifference > 0 ? (
                <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-blue-100 text-blue-900 border border-blue-200 shadow-sm">
                  ↗ เงินเกินในเก๊ะ +฿{cashDifference.toLocaleString()}
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-100 text-rose-900 border border-rose-200 shadow-sm">
                  ↘ เงินขาดจากเก๊ะ -฿{Math.abs(cashDifference).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* สเต็ปที่ 4: การนำฝากเงินสด (Cash Out) และ เงินทอนคงเหลือสำหรับวันถัดไป */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-stone-700 block">
                  เงินสดเก็บส่ง / นำฝากเจ้าของร้าน (Cash Out)
                </label>
                <span className="text-[10px] text-stone-400">เงินที่นำส่งให้เจ้าของร้าน</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                  ฿
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={cashOutInput}
                  onChange={(e) => setCashOutInput(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] text-base sm:text-sm font-bold pl-8 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 text-[11px] text-stone-500">
              <span>เงินสดคงเหลือติดเก๊ะสำหรับวันถัดไป:</span>
              <span className="font-bold text-stone-800">
                ฿{remainingFloatAfterCashOut.toLocaleString()}
              </span>
            </div>
          </div>

          {/* ช่องกรอกชื่อผู้ปิดกะ และ หมายเหตุ */}
          <div className="space-y-3 pt-2 border-t border-stone-100 text-xs">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                ชื่อผู้ปิดกะ / แคชเชียร์ *
              </label>
              <input
                type="text"
                value={closedBy}
                onChange={(e) => setClosedBy(e.target.value)}
                placeholder="เช่น ฟาริ บุญเย็น"
                autoCorrect="off"
                className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-base sm:text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="เช่น เงินสดเกิน 20 บาทจากทิปลูกค้า, โอนเคลียร์ยอดครบถ้วน..."
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-base sm:text-xs"
              />
            </div>
          </div>
        </section>

        {/* Action Buttons: ปิดกะ & พิมพ์สลิป */}
        <section className="space-y-2.5">
          <button
            type="button"
            disabled={isPending || loading}
            onClick={handleSubmitClosing}
            className="w-full min-h-[48px] bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-amber-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังบันทึกข้อมูลปิดกะ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {overview?.isClosed ? "บันทึกอัปเดตข้อมูลปิดกะ" : "🔒 บันทึกและยืนยันปิดกะประจำวัน"}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="w-full min-h-[48px] bg-white hover:bg-stone-50 text-stone-700 rounded-2xl font-bold text-xs border border-stone-200 shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-600" />
            <span>🖨️ พิมพ์ใบสรุปปิดกะ</span>
          </button>
        </section>

        {/* Quick Help Guide */}
        <section className="bg-stone-50 rounded-2xl p-4 border border-stone-200/70 text-xs text-stone-500 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-stone-700">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>แนวทางปฏิบัติการปิดกะหน้าร้าน</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-stone-500">
            <li>ตรวจสอบยอดโอน / QR ในแอปธนาคารให้ตรงกับยอดตามระบบก่อนปิดกะ</li>
            <li>หากระหว่างวันมีการหยิบเงินสดในเก๊ะไปซื้อของ ให้ลงบันทึกในหน้า &quot;บัญชีร้าน&quot; (วิธีชำระ: เงินสด) ยอดจะถูกหักออกจากระบบอัตโนมัติ</li>
            <li>นับเงินสดทั้งหมดในเก๊ะ แล้วกรอกลงในช่อง &quot;ยอดเงินสดที่นับได้จริง&quot;</li>
            <li>หากมีเงินสดเกินหรือขาด ให้ระบุเหตุผลลงในช่องหมายเหตุ</li>
            <li>กดพิมพ์สลิปปิดกะเพื่อเซ็นส่งมอบเงินสดและเก็บเข้าแฟ้มสรุปยอดของร้าน</li>
          </ul>
        </section>
      </main>

      {/* Thermal Receipt Print Modal (80mm) */}
      <ClosingReceiptModal
        overview={overview}
        actualCash={actualCash}
        cashDifference={cashDifference}
        openingFloat={openingFloat}
        cashOut={cashOut}
        closedBy={closedBy}
        notes={notes}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
}
