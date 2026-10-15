"use client";

import React, { useState, useTransition } from "react";
import { 
  ShieldCheck, 
  Ticket, 
  QrCode, 
  Banknote, 
  Loader2, 
  Check, 
  AlertCircle,
  Clock,
  Copy
} from "lucide-react";
import { PaymentMethod } from "@/types/database";
import { PetSearchResult } from "@/app/actions/customers";
import { purchaseMembership, purchaseCoupon } from "@/app/actions/packages";
import { STORE_PROFILE } from "@/lib/store-profile";
import { copyToClipboard } from "@/lib/clipboard";

interface PackagePurchaseProps {
  selectedPet: PetSearchResult | null;
  onSuccess: (orderNumber: string, note: string) => void;
  orderDate?: string;
}

const COUPON_PRESETS = [
  { name: "แพ็กเกจสุดคุ้ม 3,000", paid: 3000, value: 3300, bonus: "+฿300" },
  { name: "แพ็กเกจประหยัด 2,000", paid: 2000, value: 2150, bonus: "+฿150" },
  { name: "แพ็กเกจใหญ่ 5,000", paid: 5000, value: 5600, bonus: "+฿600" },
];

export default function PackagePurchase({ selectedPet, onSuccess, orderDate }: PackagePurchaseProps) {
  const [packageType, setPackageType] = useState<"membership" | "coupon">("membership");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State คูปอง
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customPaid, setCustomPaid] = useState<string>("3000");
  const [customValue, setCustomValue] = useState<string>("3300");
  const [isCustomCoupon, setIsCustomCoupon] = useState<boolean>(false);

  // ช่องทางชำระเงิน
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("โอนเงิน/QR");
  const [isCopiedAccount, setIsCopiedAccount] = useState(false);

  const mem = selectedPet?.active_membership;
  const isActive = mem?.status === "ใช้งานได้";
  const isExpiringSoon = mem?.status === "ใกล้หมดอายุ";
  const isExpired = mem?.status === "หมดอายุ";
  const hasMemberRecord = Boolean(mem);
  const daysLeft = mem?.expire_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(mem.expire_date).getTime() - new Date().setHours(0, 0, 0, 0)) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    setIsCustomCoupon(false);
    setCustomPaid(COUPON_PRESETS[index].paid.toString());
    setCustomValue(COUPON_PRESETS[index].value.toString());
  };

  const handleSubmit = () => {
    if (!selectedPet || !selectedPet.customer?.id) {
      setErrorMessage("กรุณาเลือกลูกค้าและสัตว์เลี้ยงก่อนทำรายการ");
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      if (packageType === "membership") {
        const res = await purchaseMembership({
          customerId: selectedPet.customer!.id,
          petId: selectedPet.id,
          paymentMethod,
          orderDate,
        });

        if (res.success && res.orderNumber) {
          const actionText = res.isRenewal ? "ต่ออายุสมาชิกสำเร็จ" : "สมัครสมาชิกสำเร็จ";
          onSuccess(
            res.orderNumber,
            `${actionText} • รหัส ${res.memberCode} (หมดอายุใหม่ ${new Date(res.expireDate!).toLocaleDateString("th-TH")})`
          );
        } else {
          setErrorMessage(res.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
        }
      } else {
        const paid = parseFloat(customPaid) || 0;
        const value = parseFloat(customValue) || 0;

        if (paid <= 0 || value <= 0) {
          setErrorMessage("กรุณากรอกยอดเงินคูปองให้ถูกต้อง");
          return;
        }

        const res = await purchaseCoupon({
          customerId: selectedPet.customer!.id,
          petId: selectedPet.id,
          paidAmount: paid,
          packageValue: value,
          paymentMethod,
          orderDate,
        });

        if (res.success && res.orderNumber) {
          onSuccess(
            res.orderNumber,
            `เปิดขายคูปองสำเร็จ • รหัส ${res.couponCode} (ยอดจ่าย ฿${paid.toLocaleString()} • ยอดใช้ได้ ฿${value.toLocaleString()})`
          );
        } else {
          setErrorMessage(res.error || "เกิดข้อผิดพลาดในการเปิดขายคูปอง");
        }
      }
    });
  };

  const payableAmount = packageType === "membership" ? 299 : parseFloat(customPaid) || 0;

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* สวิตช์เลือกประเภทแพ็กเกจ */}
      <div className="grid grid-cols-2 p-1 bg-stone-200/70 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setPackageType("membership")}
          className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            packageType === "membership"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>สมาชิกรายปี (299.-)</span>
        </button>

        <button
          type="button"
          onClick={() => setPackageType("coupon")}
          className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            packageType === "coupon"
              ? "bg-white text-stone-900 shadow-sm"
              : "text-stone-600 hover:text-stone-800"
          }`}
        >
          <Ticket className="w-4 h-4 text-amber-600" />
          <span>แพ็กเกจคูปองเงินสด</span>
        </button>
      </div>

      {/* แบบที่ 1: สมาชิกรายปี 299 */}
      {packageType === "membership" && (
        <section className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-900 text-base">สิทธิ์สมาชิกรายปี Fur Fur Club</h3>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                  ลด 10%
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                รับส่วนลดค่าบริการกรูมมิ่ง 10% ทุกครั้งตลอด 1 ปีเต็ม (ผูกกับน้องที่เลือก)
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-amber-700">฿299</span>
              <span className="text-[10px] text-stone-400 block">/ ปี</span>
            </div>
          </div>

          {isExpiringSoon && (
            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-300 text-xs text-amber-950 space-y-2">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">
                    สมาชิกใกล้หมดอายุ (เหลืออีก {daysLeft} วัน)
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    รหัสเดิม: {mem?.member_code} • หมดอายุ:{" "}
                    {mem?.expire_date
                      ? new Date(mem.expire_date).toLocaleDateString("th-TH")
                      : "-"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-lg font-medium">
                💡 สามารถต่ออายุล่วงหน้าได้ทันที โดยระบบจะขยายเวลาเพิ่มอีก 365 วันต่อจากวันหมดอายุเดิมอัตโนมัติ (ไม่เสียวันคงเหลือ)
              </p>
            </div>
          )}

          {isActive && !isExpiringSoon && (
            <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 text-xs text-emerald-950 space-y-2">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900">น้องมีสถานะสมาชิก ใช้งานได้ อยู่แล้ว</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    รหัส: {mem?.member_code} • หมดอายุ:{" "}
                    {mem?.expire_date
                      ? new Date(mem.expire_date).toLocaleDateString("th-TH")
                      : "-"}{" "}
                    (เหลือ {daysLeft} วัน)
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-emerald-800 bg-emerald-100/70 p-2 rounded-lg font-medium">
                💡 หากต่ออายุตอนนี้ ระบบจะเพิ่ม 365 วันต่อจากวันหมดอายุเดิมให้อัตโนมัติ
              </p>
            </div>
          )}

          {isExpired && (
            <div className="bg-rose-50 rounded-xl p-3.5 border border-rose-200 text-xs text-rose-950 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">สมาชิกหมดอายุแล้ว</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    รหัส: {mem?.member_code} • หมดอายุเมื่อ:{" "}
                    {mem?.expire_date
                      ? new Date(mem.expire_date).toLocaleDateString("th-TH")
                      : "-"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-rose-800 bg-rose-100/70 p-2 rounded-lg font-medium">
                กดเปิดบิลรับเงิน ฿299 เพื่อต่ออายุสมาชิก รหัสเดิมจะได้รับสิทธิส่วนลด 10% ต่อไปอีก 1 ปีเต็ม
              </p>
            </div>
          )}

          {!hasMemberRecord && (
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-100 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-700">✨ สิทธิประโยชน์ที่ได้รับทันที:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-stone-500">
                <li>ส่วนลด 10% ค่าอาบน้ำ ตัดขน สปา ทุกครั้ง</li>
                <li>อายุการใช้งาน 365 วัน นับจากวันที่เปิดบิล</li>
                <li>ระบบจะติ๊กส่วนลด 10% อัตโนมัติทุกครั้งที่เปิดบิลกรูมมิ่ง</li>
              </ul>
            </div>
          )}
        </section>
      )}

      {/* แบบที่ 2: แพ็กเกจคูปอง */}
      {packageType === "coupon" && (
        <section className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-stone-900 text-sm">เลือกแพ็กเกจคูปองเงินสด</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              เติมเงินล่วงหน้าเพื่อใช้หักค่าบริการกรูมมิ่งในครั้งถัดไป
            </p>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-3 gap-2">
            {COUPON_PRESETS.map((preset, index) => {
              const isSelected = !isCustomCoupon && selectedPresetIndex === index;
              return (
                <button
                  key={preset.paid}
                  type="button"
                  onClick={() => handleSelectPreset(index)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                      : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md inline-block mb-1">
                    {preset.bonus}
                  </span>
                  <div className="font-extrabold text-stone-900 text-sm">
                    ฿{preset.paid.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-stone-500">
                    ได้ใช้ ฿{preset.value.toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* กำหนดเอง */}
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsCustomCoupon(!isCustomCoupon)}
              className="text-xs text-stone-500 font-bold hover:text-stone-800 underline block mb-2"
            >
              {isCustomCoupon ? "← เลือกแพ็กเกจสำเร็จรูป" : "หรือระบุยอดเงินเอง..."}
            </button>

            {isCustomCoupon && (
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">
                    ยอดเงินที่ลูกค้าจ่าย (บาท)
                  </label>
                  <input
                    type="number"
                    value={customPaid}
                    onChange={(e) => setCustomPaid(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">
                    มูลค่าเครดิตที่ได้ (บาท)
                  </label>
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-xs font-bold text-amber-700"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

          {/* ช่องทางชำระเงิน */}
      <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
        <label className="text-xs font-bold text-stone-700 block">
          วิธีรับชำระเงิน (฿{payableAmount.toLocaleString()})
        </label>
        
        {/* 👉 เปลี่ยนตรงนี้เป็น grid-cols-2 */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "โอนเงิน/QR", label: "โอนเงิน / QR", icon: QrCode },
            { id: "เงินสด", label: "เงินสด", icon: Banknote },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id as PaymentMethod)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl text-xs font-bold border gap-1.5 transition-all ${
                paymentMethod === id
                  ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                  : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ข้อมูลบัญชีธนาคาร & QR Code สำหรับแพ็กเกจ */}
        {paymentMethod === "โอนเงิน/QR" && (
          <div className="p-3 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-stone-50 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 bg-white rounded-lg p-1 border border-stone-200 shrink-0 shadow-xs">
                <img
                  src={STORE_PROFILE.bank.qrImageUrl}
                  alt="QR Payment"
                  className="w-full h-full object-contain rounded"
                />
              </div>

              <div className="min-w-0 space-y-0.5">
                <span className="text-[11px] font-bold text-emerald-800 block">
                  🏦 {STORE_PROFILE.bank.bankName}
                </span>
                <p className="font-mono font-black text-xs text-stone-900 tracking-wide truncate">
                  {STORE_PROFILE.bank.accountNumber}
                </p>
                <p className="text-[10px] text-stone-500 truncate">
                  {STORE_PROFILE.bank.accountName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(STORE_PROFILE.bank.rawAccountNumber);
                if (ok) {
                  setIsCopiedAccount(true);
                  setTimeout(() => setIsCopiedAccount(false), 2000);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-[10px] font-bold hover:bg-stone-50 active:scale-95 transition-all shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              {isCopiedAccount ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  <span className="text-emerald-700">คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-stone-500" />
                  <span>คัดลอกเลขบัญชี</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>


      {/* ปุ่มกดเปิดบิลรับเงิน */}
      <button
        type="button"
        disabled={!selectedPet || isPending || payableAmount <= 0}
        onClick={handleSubmit}
        className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังบันทึกข้อมูล...</span>
          </>
        ) : (
          <span>
            {packageType === "membership"
              ? hasMemberRecord
                ? `ต่ออายุสมาชิก ฿299 (${mem?.member_code || ""})`
                : "เปิดบิลสมัครสมาชิก ฿299"
              : `เปิดบิลขายคูปอง ฿${payableAmount.toLocaleString()}`}
          </span>
        )}
      </button>
    </div>
  );
}
