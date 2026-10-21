"use client";

import React, { useEffect, useState } from "react";
import { 
  X, 
  Ticket, 
  Calendar, 
  ArrowDownRight, 
  ArrowUpRight, 
  PlusCircle, 
  Scissors, 
  RotateCcw,
  Clock,
  FileText
} from "lucide-react";
import { CouponWithDetails, CouponTransaction } from "@/types/database";
import { getCouponTransactions } from "@/app/actions/coupons";

interface CouponHistoryModalProps {
  coupon: CouponWithDetails | null;
  onClose: () => void;
}

export default function CouponHistoryModal({ coupon, onClose }: CouponHistoryModalProps) {
  const [transactions, setTransactions] = useState<CouponTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupon) return;

    let isMounted = true;
    setLoading(true);

    getCouponTransactions(coupon.id)
      .then((res) => {
        if (isMounted) {
          if (res.success) {
            setTransactions(res.transactions);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [coupon]);

  if (!coupon) return null;

  const pkgValue = Number(coupon.package_value) || 0;
  const remBalance = Number(coupon.remaining_balance) || 0;
  const usedAmount = Math.max(0, pkgValue - remBalance);
  const percentRemaining = pkgValue > 0 ? Math.round((remBalance / pkgValue) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full sm:max-w-xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-start justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold border border-amber-200/60 shrink-0">
              <Ticket className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-stone-900 text-base">
                  รหัส {coupon.coupon_code || "คูปองเงินสด"}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  coupon.status === "ใช้งานได้" && remBalance > 0
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-stone-100 text-stone-600 border-stone-200"
                }`}>
                  {coupon.status === "ใช้งานได้" && remBalance > 0 ? "ใช้งานได้" : "ใช้หมดแล้ว"}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                น้อง{coupon.pet?.name || "ไม่ระบุสัตว์เลี้ยง"}
                {coupon.pet?.customer?.name && ` • ลูกค้า: ${coupon.pet.customer.name}`}
                {coupon.pet?.customer?.phone && ` (${coupon.pet.customer.phone})`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Coupon Value Overview Card */}
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-amber-50/40">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-2xl border border-amber-100 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 block">มูลค่าแพ็กเกจ</span>
              <span className="text-sm font-black text-stone-800 block mt-0.5">
                ฿{pkgValue.toLocaleString()}
              </span>
              <span className="text-[9px] text-amber-700 block">จ่ายจริง ฿{(Number(coupon.paid_amount) || 0).toLocaleString()}</span>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-amber-200 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 block">ยอดคงเหลือ</span>
              <span className="text-sm font-black text-amber-700 block mt-0.5">
                ฿{remBalance.toLocaleString()}
              </span>
              <span className="text-[9px] text-stone-400 block">เหลือ {percentRemaining}%</span>
            </div>

            <div className="bg-white p-2.5 rounded-2xl border border-stone-100 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 block">ใช้ไปแล้ว</span>
              <span className="text-sm font-black text-stone-700 block mt-0.5">
                ฿{usedAmount.toLocaleString()}
              </span>
              <span className="text-[9px] text-stone-400 block">
                {transactions.length} รายการ
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-stone-200/80 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(0, percentRemaining))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Transaction History List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>ประวัติการทำรายการ (Transaction History)</span>
            </h3>
            <span className="text-[11px] font-medium text-stone-400">
              {transactions.length} รายการ
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-stone-400 font-medium">กำลังโหลดประวัติการใช้งาน...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-stone-200 rounded-2xl space-y-2 bg-stone-50/50">
              <FileText className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs font-bold text-stone-500">ยังไม่มีบันทึกประวัติธุรกรรมในระบบ</p>
              <p className="text-[11px] text-stone-400">เมื่อมีการตัดใช้บริการบิล Grooming จะแสดงประวัติที่นี่</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transactions.map((tx) => {
                const isDeduct = tx.transaction_type === "deduct";
                const isRefund = tx.transaction_type === "refund";

                const dateStr = new Date(tx.created_at).toLocaleString("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl border border-stone-200/80 bg-white hover:bg-stone-50/60 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isDeduct
                          ? "bg-amber-100 text-amber-700"
                          : isRefund
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {isDeduct ? (
                          <Scissors className="w-4 h-4" />
                        ) : isRefund ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <PlusCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-stone-800">
                            {isDeduct ? "หักค่าบริการ" : isRefund ? "คืนยอดคูปอง (Void บิล)" : "เปิดซื้อคูปอง"}
                          </span>
                          {tx.order?.order_number && (
                            <span className="text-[10px] font-extrabold bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded border border-stone-200">
                              #{tx.order.order_number}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-stone-500 mt-0.5 truncate">
                          {tx.notes || (tx.order?.service_description ? `บริการ: ${tx.order.service_description}` : "-")}
                        </p>

                        <p className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-xs font-black flex items-center justify-end gap-0.5 ${
                        isDeduct
                          ? "text-rose-600"
                          : isRefund
                          ? "text-emerald-600"
                          : "text-purple-700"
                      }`}>
                        {isDeduct ? (
                          <>
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            <span>-฿{(Number(tx.amount) || 0).toLocaleString()}</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>+฿{(Number(tx.amount) || 0).toLocaleString()}</span>
                          </>
                        )}
                      </div>

                      {tx.balance_after != null && (
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          คงเหลือ ฿{Number(tx.balance_after).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-stone-100 bg-stone-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
