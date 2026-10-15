"use client";

import React from "react";
import { Printer, X, Lock, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DailyClosingOverview } from "@/app/actions/daily-closing";

interface ClosingReceiptModalProps {
  overview: DailyClosingOverview | null;
  actualCash: number;
  cashDifference: number;
  openingFloat: number;
  cashOut: number;
  closedBy: string;
  notes: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClosingReceiptModal({
  overview,
  actualCash,
  cashDifference,
  openingFloat,
  cashOut,
  closedBy,
  notes,
  isOpen,
  onClose,
}: ClosingReceiptModalProps) {
  if (!isOpen || !overview) return null;

  // ป้องกัน Background Scroll Bleed บน iOS Safari เมื่อเปิด Bottom Sheet
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(overview.date).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const closedAtTime = overview.savedClosing?.closed_at
    ? new Date(overview.savedClosing.closed_at).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const cashExpenses = overview.systemCashExpenses || 0;
  const systemNetCash = overview.systemNetCash ?? (overview.systemCashAmount - cashExpenses);
  const expectedDrawerCash = openingFloat + overview.systemCashAmount - cashExpenses;
  const remainingFloatAfterCashOut = actualCash - cashOut;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm print:p-0 print:bg-white print:static print:inset-auto animate-in fade-in duration-200">
      {/* Container */}
      <div className="relative w-full max-w-sm bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:h-auto print:w-[80mm] print:max-w-[80mm] print:shadow-none print:border-none print:rounded-none animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-[calc(0.75rem+env(safe-area-inset-bottom))] print:pb-0 overscroll-contain">
        
        {/* iOS Sheet Grabber */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0 print:hidden" />

        {/* Modal Top Bar (Screen only) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/80 print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
            <Lock className="w-4 h-4 text-amber-600" />
            <span>ใบสรุปปิดกะประจำวัน</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Slip Content (Print Area) */}
        <div className="p-6 overflow-y-auto print:p-3 print:overflow-visible font-mono text-[12px] text-stone-800 space-y-4 print:text-[11px] print:space-y-3">
          
          {/* Header ร้าน */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-300">
            <h2 className="text-base font-black tracking-tight text-stone-950 font-sans print:text-sm">
              FUR FUR &
            </h2>
            <p className="text-[11px] font-sans font-bold text-amber-700">
              ใบสรุปปิดกะและกระทบยอดเงินสด
            </p>
            <p className="text-[10px] text-stone-500 font-sans">
              เฟอ เฟอ แอนด์
            </p>
          </div>

          {/* ข้อมูลวันที่และเวลาปิดกะ */}
          <div className="text-[11px] space-y-1 pb-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">รอบวันที่:</span>
              <span className="font-bold text-stone-900">{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">เวลาปิดกะ:</span>
              <span className="text-stone-700">{closedAtTime} น.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">ผู้ปิดกะ:</span>
              <span className="font-semibold text-stone-800">{closedBy || "แคชเชียร์"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">จำนวนบิลทั้งหมด:</span>
              <span className="font-bold text-stone-900">{overview.totalOrdersCount} บิล</span>
            </div>
          </div>

          {/* สรุปยอดขายตามระบบ */}
          <div className="space-y-1.5 pb-3 border-b border-dashed border-stone-300 text-xs">
            <div className="text-[10px] uppercase font-bold text-stone-400 pb-0.5">
              สรุปยอดตามระบบ (System)
            </div>
            <div className="flex justify-between text-stone-600">
              <span>ยอดขายรวมสุทธิ</span>
              <span className="font-bold text-stone-900">
                ฿{overview.systemTotalSales.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>ยอดรับโอน / QR</span>
              <span>฿{overview.systemTransferAmount.toLocaleString()}</span>
            </div>
            {overview.systemCouponDeducted > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>ยอดหักคูปอง</span>
                <span>฿{overview.systemCouponDeducted.toLocaleString()}</span>
              </div>
            )}

            <div className="pt-1 border-t border-stone-100 space-y-1">
              <div className="flex justify-between text-stone-700">
                <span>ยอดขายเงินสดรับเข้า</span>
                <span className="font-bold">฿{overview.systemCashAmount.toLocaleString()}</span>
              </div>

              {/* เงินสดจ่ายออก */}
              {cashExpenses > 0 ? (
                <div className="flex justify-between text-rose-700">
                  <span>หัก เงินสดจ่ายออก</span>
                  <span className="font-bold">-฿{cashExpenses.toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex justify-between text-stone-400 text-[10px]">
                  <span>หัก เงินสดจ่ายออก</span>
                  <span>฿0</span>
                </div>
              )}

              {/* รายการเงินสดจ่ายออกย่อย */}
              {overview.cashExpensesList && overview.cashExpensesList.length > 0 && (
                <div className="pl-2 space-y-0.5 text-[10px] text-rose-600/90 py-0.5">
                  {overview.cashExpensesList.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="truncate max-w-[170px]">• {item.title}</span>
                      <span>-฿{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-1 border-t border-dashed border-stone-200 font-bold text-stone-900">
                <span>เงินสดสุทธิตามระบบ</span>
                <span className="text-amber-800">฿{systemNetCash.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ตรวจนับเงินสดจริง & กระทบยอด */}
          <div className="space-y-1.5 pb-3 border-b border-dashed border-stone-300 text-xs">
            <div className="text-[10px] uppercase font-bold text-stone-400 pb-0.5">
              ตรวจนับเงินสดจริง (Reconciliation)
            </div>

            {openingFloat > 0 && (
              <div className="flex justify-between text-stone-600 text-[11px]">
                <span>เงินทอนตั้งต้น (Float):</span>
                <span>฿{openingFloat.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-stone-700 text-[11px]">
              <span>ยอดเงินสดที่ควรมีในเก๊ะ:</span>
              <span className="font-bold">฿{expectedDrawerCash.toLocaleString()}</span>
            </div>

            <div className="flex justify-between font-bold text-stone-900 pt-0.5">
              <span>เงินสดนับได้จริงในเก๊ะ:</span>
              <span className="text-base font-black text-stone-950">
                ฿{actualCash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-stone-100">
              <span className="font-medium text-stone-600">ผลต่างเงินสด:</span>
              <span
                className={`font-black text-sm inline-flex items-center gap-0.5 ${
                  cashDifference === 0
                    ? "text-emerald-700"
                    : cashDifference > 0
                    ? "text-blue-700"
                    : "text-rose-700"
                }`}
              >
                {cashDifference === 0 ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 inline" />
                    ตรงเป๊ะ (฿0)
                  </>
                ) : cashDifference > 0 ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5 inline" />
                    เกิน +฿{cashDifference.toLocaleString()}
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-3.5 h-3.5 inline" />
                    ขาด -฿{Math.abs(cashDifference).toLocaleString()}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* การจัดการเงินสดในเก๊ะ */}
          {(openingFloat > 0 || cashOut > 0) && (
            <div className="space-y-1 pb-3 border-b border-dashed border-stone-300 text-[11px] text-stone-600">
              <div className="text-[10px] uppercase font-bold text-stone-400 pb-0.5">
                จัดการเงินสดเก๊ะ (Cash Float & Out)
              </div>
              {cashOut > 0 && (
                <div className="flex justify-between font-medium text-stone-800">
                  <span>เงินสดเก็บส่ง/นำฝาก:</span>
                  <span className="font-bold">฿{cashOut.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-600">
                <span>เงินสดคงเหลือติดเก๊ะ:</span>
                <span className="font-semibold text-stone-900">฿{remainingFloatAfterCashOut.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* หมายเหตุ */}
          {notes && notes.trim() && (
            <div className="pb-3 border-b border-dashed border-stone-300 text-[10px] text-stone-600">
              <span className="font-bold text-stone-700 block mb-0.5">หมายเหตุ:</span>
              <p className="font-sans leading-relaxed">{notes.trim()}</p>
            </div>
          )}

          {/* ลายเซ็นส่งมอบกะ */}
          <div className="pt-3 space-y-8 font-sans text-center text-[10px] text-stone-500">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-8">ผู้ส่งมอบกะ</p>
                <div className="border-t border-stone-300 pt-1">
                  <p className="font-bold text-stone-800 whitespace-nowrap">( {closedBy || "...................."} )</p>
                </div>
              </div>
              <div>
                <p className="mb-8">ผู้รับเงิน / ตรวจสอบ</p>
                <div className="border-t border-stone-300 pt-1">
                  <p className="font-bold text-stone-800 whitespace-nowrap">( .................... )</p>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-stone-400">
              * เอกสารสรุปปิดกะออกโดยระบบ Fur Fur & POS *
            </p>
          </div>
        </div>

        {/* Modal Actions (Screen only) */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
          >
            ปิดหน้าต่าง
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์สลิปปิดกะ</span>
          </button>
        </div>
      </div>

      {/* Global Print Styles for Thermal Paper */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
