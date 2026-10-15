"use client";

import React, { useState, useEffect } from "react";
import { X, Scissors, ShoppingBag, Ticket, ShieldCheck, Check, MessageCircle, QrCode, Copy } from "lucide-react";
import { OrderDetailResult, OrderRetailItemSummary } from "@/app/actions/orders";
import { STORE_PROFILE } from "@/lib/store-profile";

interface ReceiptModalProps {
  order: OrderDetailResult | null;
  isOpen: boolean;
  onClose: () => void;
  isNewOrder?: boolean;
  closeButtonText?: string;
  onNewOrderNext?: () => void;
}

function generateLineSummary(order: OrderDetailResult): string {
  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : order.order_date;

  const lines: string[] = [
    `🐾 สรุปค่าบริการ ${STORE_PROFILE.name} (${STORE_PROFILE.nameTh})`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `สาขา: ${STORE_PROFILE.branch}`,
    `บิลเลขที่: ${order.order_number}`,
    `วันที่: ${formattedDate}`,
  ];

  if (order.customer?.name) {
    lines.push(`ลูกค้า: คุณ${order.customer.name}`);
  }

  lines.push(`------------------------------------`);
  lines.push(`รายการ:`);

  // Grooming items
  const retailSum = order.retail_items?.reduce((s, i) => s + Number(i.total_price || 0), 0) || 0;
  const groomingFullPrice = Math.max(0, Number(order.full_price) - retailSum);
  const hasGrooming = order.order_type === "grooming" || (!order.order_type && groomingFullPrice > 0);

  if (hasGrooming) {
    const baseGroomingText = order.service_description?.split(" + สินค้าปลีก")[0] || "";
    if (baseGroomingText.includes(" • [")) {
      const parts = baseGroomingText.split(" • ");
      for (const part of parts) {
        lines.push(` • ${part}`);
      }
    } else {
      const petPrefix = order.pet?.name ? `น้อง${order.pet.name}: ` : "";
      lines.push(` • ${petPrefix}${baseGroomingText || "บริการ Grooming"} ฿${groomingFullPrice.toLocaleString()}`);
    }
  }

  // Retail items
  if (order.retail_items && order.retail_items.length > 0) {
    for (const item of order.retail_items) {
      lines.push(` • ${item.product_name} (${item.quantity} ชิ้น) ฿${Number(item.total_price).toLocaleString()}`);
    }
  }

  // Other types
  if (order.order_type !== "grooming" && (!order.retail_items || order.retail_items.length === 0)) {
    lines.push(` • ${order.service_description || "บริการ"} ฿${Number(order.full_price).toLocaleString()}`);
  }

  // Discount
  if (order.discount_text && order.discount_text !== "0%" && !order.discount_text.includes("[VOID]")) {
    const discountAmount = Math.max(
      0,
      Math.round(Number(order.full_price) - (Number(order.net_paid) + Number(order.coupon_deducted || 0)))
    );
    if (discountAmount > 0) {
      lines.push(`ส่วนลด (${order.discount_text}): -฿${discountAmount.toLocaleString()}`);
    }
  }

  // Coupon deducted
  if (Number(order.coupon_deducted) > 0) {
    lines.push(`หักคูปองเงินสด: -฿${Number(order.coupon_deducted).toLocaleString()}`);
  }

  lines.push(`------------------------------------`);
  lines.push(`ยอดชำระสุทธิ: ฿${Number(order.net_paid).toLocaleString()} บาท`);
  lines.push(`วิธีชำระเงิน: ${order.payment_method}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📌 ช่องทางชำระเงิน:`);
  lines.push(`${STORE_PROFILE.bank.bankName}`);
  lines.push(`เลขที่บัญชี: ${STORE_PROFILE.bank.accountNumber}`);
  lines.push(`ชื่อบัญชี: ${STORE_PROFILE.bank.accountName}`);
  lines.push(`(สแกน QR Code พร้อมเพย์ หรือโอนเข้าบัญชีร้านได้เลยนะคะ/ครับ)`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`ขอบคุณที่พาน้องๆ มาใช้บริการนะคะ/ครับ ❤🐶🐱`);

  return lines.join("\n");
}

import { copyToClipboard } from "@/lib/clipboard";

export default function ReceiptModal({ 
  order, 
  isOpen, 
  onClose,
  isNewOrder = false,
  closeButtonText,
  onNewOrderNext,
}: ReceiptModalProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedAccount, setIsCopiedAccount] = useState(false);

  const handleClose = () => {
    if (onNewOrderNext) {
      onNewOrderNext();
    }
    onClose();
  };

  // ป้องกัน Background Scroll Bleed บน iOS Safari เมื่อเปิด Bottom Sheet
  useEffect(() => {
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

  if (!isOpen || !order) return null;

  const handleCopyLineText = async () => {
    try {
      const summaryText = generateLineSummary(order);
      const ok = await copyToClipboard(summaryText);
      if (ok) {
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 3500);
      }
    } catch (err) {
      console.error("Failed to copy LINE summary:", err);
    }
  };

  const formattedDateTime = order.created_at
    ? new Date(order.created_at).toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : order.order_date;

  const getOrderTypeBadge = () => {
    switch (order.order_type) {
      case "grooming":
        return { label: "บริการ Grooming", icon: Scissors };
      case "retail":
        return { label: "สินค้าขายปลีก", icon: ShoppingBag };
      case "membership":
        return { label: "สมาชิกรายปี 299", icon: ShieldCheck };
      case "coupon":
        return { label: "แพ็กเกจคูปอง", icon: Ticket };
      default:
        return { label: "คำสั่งซื้อ", icon: Scissors };
    }
  };

  const typeBadge = getOrderTypeBadge();
  const TypeIcon = typeBadge.icon;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      {/* Container */}
      <div 
        className="relative w-full max-w-sm bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Sheet Grabber */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-stone-50/80 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
            <TypeIcon className="w-4 h-4 text-amber-600" />
            <span>สลิปใบเสร็จรับเงิน (Digital)</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slip Content Scrollable Area */}
        <div className="p-5 overflow-y-auto font-mono text-[12px] text-stone-800 space-y-4 overscroll-contain">
          
          {/* แบนเนอร์เปิดบิลสำเร็จเมื่อทำรายการจากหน้าคิดเงิน */}
          {isNewOrder && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-1">
              <span className="font-sans font-black text-xs flex items-center justify-center gap-1.5 text-emerald-800">
                <Check className="w-4 h-4 stroke-[3] text-emerald-600" />
                เปิดบิลชำระเงินสำเร็จ
              </span>
              <p className="font-sans text-[11px] text-emerald-700 leading-tight">
                สแกนจ่าย QR หน้าร้าน หรือกดส่งยอดเข้า LINE ได้ทันที
              </p>
            </div>
          )}

          {/* Header ร้าน */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-300">
            <h2 className="text-base font-black tracking-tight text-stone-950 font-sans">
              {STORE_PROFILE.name}
            </h2>
            <p className="text-[11px] font-sans font-bold text-stone-700 leading-tight">
              {STORE_PROFILE.nameTh}
            </p>
            <p className="text-[10px] text-amber-800 font-sans font-semibold">
              สาขา {STORE_PROFILE.branch}
            </p>
            <p className="text-[9.5px] text-stone-500 font-sans leading-tight">
              {STORE_PROFILE.shortAddress}
            </p>
            <p className="text-[10px] text-stone-500 font-sans">
              โทร: {STORE_PROFILE.phone} • LINE: {STORE_PROFILE.lineId}
            </p>
          </div>

          {/* แบนเนอร์แจ้งเตือนบิลที่ถูกยกเลิก (VOID) */}
          {(order.isVoided || order.status === "voided" || order.status === "ยกเลิก") && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-center space-y-0.5">
              <span className="font-sans font-black text-xs block text-rose-700">
                *** บิลนี้ถูกยกเลิกแล้ว (VOIDED) ***
              </span>
              {order.void_reason && (
                <span className="font-sans text-[10px] text-rose-600 block">
                  เหตุผล: {order.void_reason}
                </span>
              )}
            </div>
          )}

          {/* ข้อมูลคำสั่งซื้อและลูกค้า */}
          <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-stone-300">
            <div className="flex justify-between">
              <span className="text-stone-500">เลขที่บิล:</span>
              <span className="font-bold text-stone-900">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">วันที่:</span>
              <span className="text-stone-700">{formattedDateTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">ประเภท:</span>
              <span className="font-semibold text-amber-800">{typeBadge.label}</span>
            </div>

            {/* ข้อมูลลูกค้าและสัตว์เลี้ยง */}
            {(order.customer || order.pet) && (
              <div className="pt-1.5 mt-1.5 border-t border-stone-100 space-y-1">
                {order.customer && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">ลูกค้า:</span>
                    <span className="font-semibold text-stone-800">
                      คุณ{order.customer.name}
                      {order.customer.phone ? ` (${order.customer.phone})` : ""}
                    </span>
                  </div>
                )}
                {(() => {
                  const baseGroomingText = order.service_description?.split(" + สินค้าปลีก")[0] || "";
                  const isMultiPetGrooming = baseGroomingText.includes(" • [");

                  if (isMultiPetGrooming) {
                    return (
                      <div className="flex justify-between">
                        <span className="text-stone-500">สัตว์เลี้ยง:</span>
                        <span className="font-semibold text-amber-900">
                          {baseGroomingText.split(" • ").length} ตัว (Multi-Pet)
                        </span>
                      </div>
                    );
                  }

                  if (order.pet) {
                    return (
                      <div className="flex justify-between">
                        <span className="text-stone-500">สัตว์เลี้ยง:</span>
                        <span className="font-semibold text-stone-800">
                          น้อง{order.pet.name} ({order.pet.species}{order.pet.breed ? ` ${order.pet.breed}` : ""})
                        </span>
                      </div>
                    );
                  }

                  return null;
                })()}
              </div>
            )}
          </div>

          {/* รายการสินค้า / บริการ */}
          <div className="space-y-2 pb-3 border-b border-dashed border-stone-300">
            <div className="text-[10px] uppercase font-bold text-stone-400 pb-1">
              รายการ (Item / Description)
            </div>

            {/* รายการบริการ Grooming (ถ้ามี) */}
            {(() => {
              const retailSum = order.retail_items?.reduce((s, i) => s + Number(i.total_price || 0), 0) || 0;
              const groomingFullPrice = Math.max(0, Number(order.full_price) - retailSum);
              const hasGrooming = order.order_type === "grooming" || (!order.order_type && groomingFullPrice > 0);
              if (!hasGrooming) return null;

              const baseGroomingText = order.service_description?.split(" + สินค้าปลีก")[0] || "";
              const isMultiPetGrooming = baseGroomingText.includes(" • [");

              if (isMultiPetGrooming) {
                const parts = baseGroomingText.split(" • ");
                return (
                  <div className="space-y-1.5 pb-1">
                    {parts.map((part, idx) => {
                      const match = part.match(/^(?:\[([^\]]+)\]\s*)?(.*?)(?:\s*฿([\d,]+))?$/);
                      const petName = match?.[1] || "";
                      const desc = match?.[2]?.trim() || "Grooming";
                      const price = match?.[3] || "";
                      return (
                        <div key={idx} className="flex justify-between font-sans text-xs">
                          <span className="font-semibold text-stone-800 flex-1 pr-2">
                            {petName ? `[${petName}] ` : ""}{desc}
                          </span>
                          <span className="font-bold text-stone-900">
                            {price ? `฿${price}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="space-y-1 pb-1">
                  <div className="flex justify-between font-sans text-xs">
                    <span className="font-semibold text-stone-800 flex-1 pr-2">
                      {baseGroomingText || "บริการ Grooming"}
                    </span>
                    <span className="font-bold text-stone-900">
                      ฿{groomingFullPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* รายการสินค้าปลีก (ถ้ามี) */}
            {order.retail_items && order.retail_items.length > 0 && (
              <div className={`space-y-2 ${order.order_type === "grooming" ? "pt-2 border-t border-stone-100" : ""}`}>
                {order.order_type === "grooming" && (
                  <div className="text-[10px] font-bold text-stone-400">
                    สินค้าปลีก ({order.retail_items.length} รายการ)
                  </div>
                )}
                {order.retail_items.map((item: OrderRetailItemSummary, idx: number) => (
                  <div key={item.id || idx} className="space-y-0.5">
                    <div className="flex justify-between font-sans text-xs">
                      <span className="font-medium text-stone-800 line-clamp-1 flex-1 pr-2">
                        {item.product_name}
                      </span>
                      <span className="font-bold text-stone-900">
                        ฿{Number(item.total_price).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>{item.brand_group}</span>
                      <span>
                        {item.quantity} x ฿{Number(item.unit_price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* บิลสมาชิก หรือ คูปอง ที่ไม่มีสินค้าปลีก */}
            {order.order_type !== "grooming" && (!order.retail_items || order.retail_items.length === 0) && (
              <div className="space-y-1">
                <div className="flex justify-between font-sans text-xs">
                  <span className="font-medium text-stone-800 flex-1 pr-2">
                    {order.service_description || typeBadge.label}
                  </span>
                  <span className="font-bold text-stone-900">
                    ฿{Number(order.full_price).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* สรุปยอดเงิน */}
          <div className="space-y-1.5 pb-3 border-b border-dashed border-stone-300 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>ยอดรวม (Total)</span>
              <span>฿{Number(order.full_price).toLocaleString()}</span>
            </div>

            {order.discount_text &&
              order.discount_text !== "0%" &&
              !order.discount_text.includes("[VOID]") && (
                <div className="flex justify-between text-amber-700">
                  <span>ส่วนลด ({order.discount_text})</span>
                  <span>
                    -฿
                    {Math.max(
                      0,
                      Math.round(
                        Number(order.full_price) -
                          (Number(order.net_paid) + Number(order.coupon_deducted || 0))
                      )
                    ).toLocaleString()}
                  </span>
                </div>
              )}

            {Number(order.coupon_deducted) > 0 && (
              <div className="flex justify-between text-amber-800 font-medium">
                <span>หักคูปองเงินสด</span>
                <span>-฿{Number(order.coupon_deducted).toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-200 font-bold text-sm text-stone-950">
              <span>ยอดชำระสุทธิ</span>
              <span className="text-base font-black">
                ฿{Number(order.net_paid).toLocaleString()}
              </span>
            </div>
          </div>

          {/* วิธีชำระเงิน */}
          <div className="flex justify-between text-[11px] pb-3 border-b border-dashed border-stone-300">
            <span className="text-stone-500">วิธีชำระเงิน:</span>
            <span className="font-bold text-stone-800">{order.payment_method}</span>
          </div>

          {/* Official KBank & PromptPay QR Code Section */}
          <div className="bg-gradient-to-b from-emerald-50/60 to-stone-50 rounded-2xl p-4 border border-emerald-200/80 text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold border border-emerald-200/80">
              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
              <span>สแกน QR หรือโอนเข้าบัญชีร้าน • {STORE_PROFILE.name}</span>
            </div>

            {/* Official KBank / PromptPay QR Image */}
            <div className="relative mx-auto w-44 bg-white rounded-2xl p-2.5 shadow-sm border border-stone-200/80 flex flex-col items-center">
              <img
                src={STORE_PROFILE.bank.qrImageUrl}
                alt="QR Code รับชำระเงิน Fur Fur &"
                className="w-full h-auto object-contain rounded-xl"
              />
            </div>

            {/* ข้อมูลบัญชีธนาคารสำหรับคัดลอก */}
            <div className="bg-white rounded-xl p-3 border border-stone-200/80 text-left space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  🏦 {STORE_PROFILE.bank.bankName}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(STORE_PROFILE.bank.rawAccountNumber);
                    if (ok) {
                      setIsCopiedAccount(true);
                      setTimeout(() => setIsCopiedAccount(false), 2500);
                    }
                  }}
                  className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
                  title="คัดลอกเลขบัญชี"
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

              <div className="text-xs space-y-0.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-stone-500 text-[11px]">เลขที่บัญชี:</span>
                  <span className="font-mono font-black text-stone-900 tracking-wider">
                    {STORE_PROFILE.bank.accountNumber}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-stone-500 text-[11px]">ชื่อบัญชี:</span>
                  <span className="font-bold text-stone-800">
                    {STORE_PROFILE.bank.accountName}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-100 flex justify-between items-baseline text-xs font-bold">
                <span className="text-stone-600">ยอดที่ต้องชำระ:</span>
                <span className="text-sm font-black text-emerald-700">
                  ฿{Number(order.net_paid).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* ท้ายบิล ข้อความขอบคุณ */}
          <div className="text-center space-y-1 pt-1 font-sans text-[10px] text-stone-500 leading-tight">
            <p className="font-medium text-stone-700">❤ ขอบคุณที่ใช้บริการ Fur Fur & ❤</p>
            <p>ยินดีให้บริการน้องๆ ทุกตัวด้วยความใส่ใจ</p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-stone-50 border-t border-stone-100 flex gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className={`px-4 min-h-[46px] rounded-xl font-bold text-xs transition-colors cursor-pointer active:scale-95 shrink-0 ${
              isNewOrder
                ? "bg-stone-900 hover:bg-stone-800 text-white shadow-sm"
                : "border border-stone-200 text-stone-600 hover:bg-stone-100 active:bg-stone-200"
            }`}
          >
            {closeButtonText || (isNewOrder ? "รับลูกค้ารายถัดไป" : "ปิด")}
          </button>

          <button
            type="button"
            onClick={handleCopyLineText}
            className={`flex-1 min-h-[46px] py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isCopied
                ? "bg-emerald-700 text-white shadow-emerald-700/20"
                : "bg-[#06C755] hover:bg-[#05b34c] text-white shadow-[#06C755]/20"
            }`}
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Copy แล้ว วางใน LINE ได้เลย</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>ส่งยอดเข้า LINE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
