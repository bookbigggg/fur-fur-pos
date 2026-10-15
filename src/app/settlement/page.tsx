// app/settlement/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useTransition } from "react";
import { 
  Building2, 
  FileText, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  Printer, 
  ShieldCheck, 
  Calendar, 
  AlertCircle, 
  CheckCircle2 
} from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { 
  getSettlementOverview, 
  markBrandAsCleared, 
  BrandSettlementSummary,
  SettlementPeriodOption
} from "@/app/actions/settlement";

type TabMode = "pending" | "cleared" | "all";

export default function SettlementDashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [periodLabel, setPeriodLabel] = useState<string>("");
  const [periodOptions, setPeriodOptions] = useState<SettlementPeriodOption[]>([]);
  const [pendingSummaries, setPendingSummaries] = useState<BrandSettlementSummary[]>([]);
  const [clearedSummaries, setClearedSummaries] = useState<BrandSettlementSummary[]>([]);
  const [activeBrands, setActiveBrands] = useState<string[]>([]);
  const [selectedQuickBrand, setSelectedQuickBrand] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabMode>("pending");
  const [loading, setLoading] = useState(true);
  const [isUpdating, startUpdate] = useTransition();

  const loadData = useCallback(async (periodToLoad?: string) => {
    setLoading(true);
    const res = await getSettlementOverview(periodToLoad || selectedPeriod);
    setSelectedPeriod(res.currentPeriod);
    setPeriodLabel(res.periodLabel);
    setPeriodOptions(res.periodOptions);
    setPendingSummaries(res.pending);
    setClearedSummaries(res.cleared);
    setActiveBrands(res.activeBrands);
    
    // ตั้งค่าแบรนด์ใน Quick Action Dropdown ให้เป็นแบรนด์แรกที่มียอดขายในเดือนนี้
    if (res.activeBrands.length > 0) {
      setSelectedQuickBrand((prev) => (res.activeBrands.includes(prev) ? prev : res.activeBrands[0]));
    } else {
      setSelectedQuickBrand("");
    }
    setLoading(false);
  }, [selectedPeriod]);

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("period");
    
    getSettlementOverview(p || undefined).then((res) => {
      if (!ignore) {
        setSelectedPeriod(res.currentPeriod);
        setPeriodLabel(res.periodLabel);
        setPeriodOptions(res.periodOptions);
        setPendingSummaries(res.pending);
        setClearedSummaries(res.cleared);
        setActiveBrands(res.activeBrands);
        if (res.activeBrands.length > 0) {
          setSelectedQuickBrand(res.activeBrands[0]);
        }
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    loadData(newPeriod);
    // อัปเดต URL query parameter แบบ soft update โดยไม่ reload หน้า
    const newUrl = `${window.location.pathname}?period=${encodeURIComponent(newPeriod)}`;
    window.history.replaceState(null, "", newUrl);
  };

  const handleMarkCleared = (brand: string) => {
    if (!confirm(`ยืนยันการเคลียร์ยอดและโอนเงินให้แบรนด์ "${brand}" สำหรับรอบเดือน "${periodLabel}" เรียบร้อยแล้ว?`)) {
      return;
    }

    startUpdate(async () => {
      await markBrandAsCleared(brand, selectedPeriod);
      await loadData(selectedPeriod);
    });
  };

  const totalPendingRemit = pendingSummaries.reduce((acc, curr) => acc + curr.remitTotal, 0);
  const totalPendingSales = pendingSummaries.reduce((acc, curr) => acc + curr.totalSales, 0);
  const totalClearedRemit = clearedSummaries.reduce((acc, curr) => acc + curr.remitTotal, 0);

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-800 pb-[max(5rem,calc(3rem+env(safe-area-inset-bottom)))] font-sans">
      {/* Header */}
      <Navbar 
        subtitle="เคลียร์เงินคู่ค้า"
        onRefresh={() => loadData(selectedPeriod)}
        isRefreshing={loading}
      />

      {/* Main Content */}
      <main className="p-4 max-w-xl mx-auto space-y-4">
        
        {/* 1. Month / Period Selector Bar (เลือกรอบเดือนสำหรับตัดยอด) */}
        <section className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="period-select" className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span>เลือกรอบเดือนที่ต้องการเคลียร์ยอด:</span>
            </label>
            {loading && <span className="text-[10px] text-stone-400 animate-pulse">กำลังโหลดข้อมูล...</span>}
          </div>

          <div className="relative">
            <select
              id="period-select"
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              disabled={loading || isUpdating}
              className="w-full min-h-[44px] bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-base sm:text-xs font-extrabold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer disabled:opacity-50"
            >
              {periodOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label} {opt.itemCount > 0 ? `(มียอดขาย ${opt.itemCount} ชิ้น)` : "(ไม่มียอดขาย)"}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* 2. Settlement Checklist Banner (สรุปงานที่ต้องทำในรอบที่เลือก) */}
        {activeBrands.length === 0 ? (
          <section className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-stone-600 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-200 text-stone-500 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">
                รอบเดือน {periodLabel}: ไม่มีรายการขายสินค้าฝากขาย
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                ไม่มีสินค้าฝากขายที่จำหน่ายได้ในรอบนี้ จึงไม่ต้องโอนเงินเคลียร์ยอดหรือออกใบสรุป
              </p>
            </div>
          </section>
        ) : pendingSummaries.length > 0 ? (
          <section className="bg-amber-500/10 border border-amber-300/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-amber-950">
                    รอบเดือน {periodLabel}: มี {pendingSummaries.length} แบรนด์ที่ต้องเคลียร์เงิน
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                    รอโอน
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  ยอดรวมต้องโอนคู่ค้า: <strong className="text-amber-950 font-black">฿{totalPendingRemit.toLocaleString()}</strong>
                  {clearedSummaries.length > 0 && ` (โอนแล้ว ${clearedSummaries.length} แบรนด์)`}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-emerald-500/10 border border-emerald-300/80 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <h3 className="text-xs font-black text-emerald-950">
                  รอบเดือน {periodLabel}: เคลียร์เงินครบทุกแบรนด์แล้ว 🎉
                </h3>
                <p className="text-[11px] text-emerald-800">
                  โอนชำระเงินสำเร็จครบทั้ง {clearedSummaries.length} แบรนด์ (ยอดโอนรวม ฿{totalClearedRemit.toLocaleString()})
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 3. KPI Banner (เฉพาะรอบเดือนที่เลือก) */}
        <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] font-bold text-stone-400 block uppercase">
              ยอดขายฝากขาย (รอบ {periodLabel})
            </span>
            <span className="text-xl font-black text-stone-900 mt-0.5 block">
              ฿{totalPendingSales.toLocaleString()}
            </span>
            <span className="text-[11px] text-stone-500">
              {pendingSummaries.reduce((a, b) => a + b.totalQuantity, 0)} ชิ้น (รอเคลียร์)
            </span>
          </div>

          <div className="border-l border-stone-100 pl-3">
            <span className="text-[10px] font-bold text-emerald-700 block uppercase">
              ยอดสุทธิต้องโอนคู่ค้า
            </span>
            <span className="text-xl font-black text-emerald-700 mt-0.5 block">
              ฿{totalPendingRemit.toLocaleString()}
            </span>
            <span className="text-[11px] text-stone-400">คำนวณหัก GP แล้ว</span>
          </div>
        </section>

        {/* 4. Quick Action Card: Export PDF (เฉพาะแบรนด์ที่มียอดขายในเดือนนี้) */}
        <section className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-white rounded-2xl p-4 border border-amber-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-stone-900 leading-tight">
                  ออกใบสรุปยอด PDF
                </h3>
                <p className="text-[10px] text-stone-500 leading-none mt-0.5">
                  รอบเดือน: {periodLabel}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
              A4 Print Ready
            </span>
          </div>

          {activeBrands.length === 0 ? (
            <div className="bg-white/80 border border-stone-200 rounded-xl p-3 text-center text-xs text-stone-500 font-medium">
              ไม่มีแบรนด์ที่มียอดขายในรอบเดือนนี้ (ไม่ต้องออกเอกสาร)
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedQuickBrand}
                onChange={(e) => setSelectedQuickBrand(e.target.value)}
                className="flex-1 min-h-[44px] bg-white border border-stone-300 rounded-xl px-3 py-2 text-base sm:text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {activeBrands.map((b) => (
                  <option key={b} value={b}>
                    แบรนด์: {b}
                  </option>
                ))}
              </select>

              <Link
                href={selectedQuickBrand ? `/settlement/${encodeURIComponent(selectedQuickBrand)}?period=${encodeURIComponent(selectedPeriod)}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center min-h-[44px] gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95 whitespace-nowrap ${
                  selectedQuickBrand
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
                    : "bg-stone-200 text-stone-400 pointer-events-none"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>พิมพ์ PDF</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </Link>
            </div>
          )}
        </section>

        {/* 5. Tab Switcher & Brand Lists */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 p-1 bg-white rounded-xl gap-1 border border-stone-200/90 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`min-h-[40px] py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                activeTab === "pending"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>รอโอนเงิน ({pendingSummaries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cleared")}
              className={`min-h-[40px] py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
                activeTab === "cleared"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>โอนแล้ว ({clearedSummaries.length})</span>
            </button>
          </div>

          {/* TAB 1: รอเคลียร์ยอด (Pending) */}
          {activeTab === "pending" && (
            <div className="space-y-3">
              {pendingSummaries.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-2">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-stone-800">
                    ไม่มีรายการรอเคลียร์ในรอบเดือน {periodLabel}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {clearedSummaries.length > 0 
                      ? "โอนเงินครบทุกแบรนด์ในรอบนี้เรียบร้อยแล้ว ตรวจสอบประวัติได้ที่แท็บ 'โอนแล้ว'" 
                      : "ไม่มีการขายสินค้าฝากขายในรอบเดือนนี้"}
                  </p>
                </div>
              ) : (
                pendingSummaries.map((brand) => (
                  <div
                    key={brand.brandGroup}
                    className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3 hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-sm border border-amber-200/70">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-stone-900 text-sm leading-snug">
                            {brand.brandGroup}
                          </h3>
                          <p className="text-[11px] text-stone-500">
                            {brand.totalQuantity} ชิ้น • ยอดขาย ฿{brand.totalSales.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-stone-400 block font-medium">ยอดต้องโอนสุทธิ</span>
                        <span className="text-base font-black text-emerald-700">
                          ฿{brand.remitTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <Link
                        href={`/settlement/${encodeURIComponent(brand.brandGroup)}?period=${encodeURIComponent(selectedPeriod)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center min-h-[40px] gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 px-3.5 py-2 rounded-xl transition-all active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>พิมพ์ใบแจ้งยอด PDF</span>
                        <ExternalLink className="w-3 h-3 text-stone-400 ml-0.5" />
                      </Link>

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleMarkCleared(brand.brandGroup)}
                        className="inline-flex items-center min-h-[40px] gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>ยืนยันโอนเงินแล้ว</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: ประวัติที่เคลียร์แล้ว (Cleared History) */}
          {activeTab === "cleared" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1 text-xs text-stone-500">
                <span>ประวัติแบรนด์ที่ตัดรอบโอนเงินแล้ว ({clearedSummaries.length} แบรนด์)</span>
                <span className="font-bold text-emerald-700">โอนแล้วรวม ฿{totalClearedRemit.toLocaleString()}</span>
              </div>

              {clearedSummaries.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-2">
                  <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs font-bold text-stone-800">ยังไม่มีรายการที่เคลียร์ในรอบเดือน {periodLabel}</p>
                </div>
              ) : (
                clearedSummaries.map((brand) => (
                  <div
                    key={brand.brandGroup}
                    className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm border border-emerald-200/70">
                          <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-extrabold text-stone-900 text-sm leading-snug">
                              {brand.brandGroup}
                            </h3>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              โอนเงินแล้ว ✓
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500">
                            {brand.totalQuantity} ชิ้น • ยอดขาย ฿{brand.totalSales.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-stone-400 block font-medium">ยอดโอนคู่ค้าแล้ว</span>
                        <span className="text-base font-black text-emerald-800">
                          ฿{brand.remitTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-stone-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {brand.clearedAt 
                            ? `โอนเมื่อ ${new Date(brand.clearedAt).toLocaleDateString("th-TH")}` 
                            : "สถานะ: โอนเงินเรียบร้อย"}
                        </span>
                      </span>

                      {/* ปุ่มเปิดเอกสารสรุปยอด PDF ในแท็บใหม่ */}
                      <Link
                        href={`/settlement/${encodeURIComponent(brand.brandGroup)}?period=${encodeURIComponent(selectedPeriod)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 px-3 py-2 rounded-xl transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>ดูใบสรุปยอด PDF</span>
                        <ExternalLink className="w-3 h-3 text-stone-400 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
