// src/components/settings/SettingsModal.tsx
"use client";

import React from "react";
import { X, Settings, Scissors, Lock, CheckCircle2 } from "lucide-react";
import { useStoreSettings } from "@/lib/settings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useStoreSettings();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Grabber Pill for Sheet ergonomics */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Settings className="w-5 h-5 text-amber-600 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900 leading-tight">
                ตั้งค่าระบบ
              </h2>
              <p className="text-[11px] text-stone-500">
                Fur Fur &amp; Preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 1. Toggle ค่าคอมมิชชั่นช่าง */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 leading-tight">
                    ระบบค่าคอมมิชชั่นช่าง Grooming
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    เมื่อเปิดใช้งาน หน้าคิดเงินจะมีช่องให้ระบุค่าคอมมิชชั่นของช่างในแต่ละบิล (ปัจจุบันปิดไว้เพื่อความคล่องตัว)
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableStaffCommission}
                onClick={() => updateSettings({ enableStaffCommission: !settings.enableStaffCommission })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none active:scale-95 ${
                  settings.enableStaffCommission ? "bg-amber-600" : "bg-stone-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.enableStaffCommission ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 bg-white/70 py-1.5 px-2.5 rounded-lg border border-stone-200/50">
              <span className={`w-2 h-2 rounded-full ${settings.enableStaffCommission ? "bg-emerald-500" : "bg-stone-400"}`} />
              <span>
                สถานะปัจจุบัน: {settings.enableStaffCommission ? "เปิดใช้งาน (แสดงช่องค่าคอมในหน้าคิดเงิน)" : "ปิดใช้งาน (ซ่อนช่องค่าคอม)"}
              </span>
            </div>
          </div>

          {/* 2. Toggle ระบบปิดกะประจำวัน */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 leading-tight">
                    ระบบปิดกะ &amp; นับเงินสดประจำวัน
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    ระบบกระทบยอดเงินสดในเก๊ะชักกระตุก (ปัจจุบันปิดไว้ หากต้องการตรวจสอบเงินสดหน้าร้านสามารถเปิดได้)
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableDailyClosing}
                onClick={() => updateSettings({ enableDailyClosing: !settings.enableDailyClosing })}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none active:scale-95 ${
                  settings.enableDailyClosing ? "bg-amber-600" : "bg-stone-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.enableDailyClosing ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 bg-white/70 py-1.5 px-2.5 rounded-lg border border-stone-200/50">
              <span className={`w-2 h-2 rounded-full ${settings.enableDailyClosing ? "bg-emerald-500" : "bg-stone-400"}`} />
              <span>
                สถานะปัจจุบัน: {settings.enableDailyClosing ? "เปิดใช้งาน (แสดงเมนูปิดกะในแถบเมนู)" : "ปิดใช้งาน (ซ่อนเมนูปิดกะเพื่อความคลีน)"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>บันทึกและปิด</span>
          </button>
        </div>
      </div>
    </div>
  );
}
