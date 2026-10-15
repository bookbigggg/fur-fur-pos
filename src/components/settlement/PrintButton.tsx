"use client";

import { useState, useEffect } from "react";
import { Printer, MessageCircle, Check, Copy, X, Smartphone, AlertCircle } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface PrintButtonProps {
  statementNumber?: string;
  brandGroup?: string;
  periodKey?: string;
  totalSales?: number;
  totalRemit?: number;
  totalQuantity?: number;
  status?: string;
}

export default function PrintButton({
  statementNumber,
  brandGroup,
  periodKey,
  totalSales,
  totalRemit,
  totalQuantity,
  status,
}: PrintButtonProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isCopiedLine, setIsCopiedLine] = useState(false);
  const [isCopiedUrl, setIsCopiedUrl] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as unknown as { standalone?: boolean }).standalone);
      setIsIos(ios);
      setIsStandalone(standalone);
    }
  }, []);

  const generateLineText = () => {
    return [
      `🐾 สรุปยอดขายสินค้าฝากขาย ร้าน Fur Fur &`,
      `แบรนด์: ${brandGroup || "คู่ค้าฝากขาย"}`,
      periodKey ? `รอบประจำเดือน: ${periodKey}` : "",
      statementNumber ? `เลขที่ใบสรุป: ${statementNumber}` : "",
      `--------------------------------`,
      totalQuantity ? `• จำนวนที่ขายได้: ${totalQuantity} ชิ้น` : "",
      totalSales !== undefined
        ? `• ยอดขายรวม: ฿${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : "",
      totalRemit !== undefined
        ? `• ยอดโอนคืนสุทธิ: ฿${totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : "",
      status ? `• สถานะ: ${status}` : "",
      `--------------------------------`,
      `📄 ลิงก์ตรวจสอบเอกสารฉบับเต็ม:`,
      currentUrl,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleCopyLine = async () => {
    const text = generateLineText();
    const ok = await copyToClipboard(text);
    if (ok) {
      setIsCopiedLine(true);
      setTimeout(() => setIsCopiedLine(false), 3000);
    }
  };

  const handleCopyUrl = async () => {
    const ok = await copyToClipboard(currentUrl);
    if (ok) {
      setIsCopiedUrl(true);
      setTimeout(() => setIsCopiedUrl(false), 3000);
    }
  };

  const handlePrint = () => {
    // บน iOS ในโหมด Standalone (แอปหน้าจอโฮม) WebKit จะตัดฟังก์ชัน window.print() ทิ้ง
    if (isIos && isStandalone) {
      setShowIosModal(true);
      return;
    }

    try {
      const originalTitle = document.title;
      if (statementNumber) {
        document.title = statementNumber;
      }
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1500);
    } catch {
      setShowIosModal(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* ปุ่มส่งยอดเข้า LINE (Copy ข้อความพร้อมส่ง) */}
        <button
          type="button"
          onClick={handleCopyLine}
          className={`inline-flex items-center justify-center min-h-[44px] gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer ${
            isCopiedLine
              ? "bg-emerald-700 text-white shadow-emerald-700/20"
              : "bg-[#06C755] hover:bg-[#05b34c] text-white shadow-[#06C755]/20"
          }`}
          title="คัดลอกสรุปยอดเพื่อวางใน LINE"
        >
          {isCopiedLine ? (
            <>
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Copy ข้อความแล้ว!</span>
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>ส่งยอดเข้า LINE</span>
            </>
          )}
        </button>

        {/* ปุ่มพิมพ์หรือบันทึก PDF */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center min-h-[44px] gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>พิมพ์หรือบันทึก PDF</span>
        </button>
      </div>

      {/* Modal แนะนำการพิมพ์บน iOS Standalone Mode */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                วิธีบันทึก PDF จาก iPhone
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Apple ไม่อนุญาตให้สั่งพิมพ์จากแอปหน้าจอโฮมโดยตรง กรุณาทำตาม 2 ขั้นตอนนี้เพื่อบันทึกเป็น PDF ครับ:
              </p>
            </div>

            {/* ขั้นตอนที่ 1: คัดลอกลิงก์ */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                  คัดลอกลิงก์เอกสารหน้านี้
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                    isCopiedUrl
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  }`}
                >
                  {isCopiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>กดคัดลอกลิงก์</span>
                    </>
                  )}
                </button>
              </div>

              <input
                type="text"
                readOnly
                value={currentUrl}
                className="w-full text-[11px] font-mono bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-600 select-all focus:outline-hidden"
              />
            </div>

            {/* ขั้นตอนที่ 2: เปิด Safari */}
            <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200/80 space-y-2 text-xs text-amber-950">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] flex items-center justify-center font-bold">2</span>
                ไปเปิดในแอป Safari แล้วบันทึก PDF
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-amber-900/90 pl-1 leading-relaxed">
                <li>สลับไปเปิดแอป <strong>Safari</strong> แล้วกดวางลิงก์ที่คัดลอก</li>
                <li>แตะปุ่มแชร์ <strong>[↑]</strong> ด้านล่างจอของ Safari</li>
                <li>เลือกเมนู <strong>พิมพ์ (Print)</strong></li>
                <li><strong>ใช้ 2 นิ้วถ่างซูมออก</strong> ที่หน้าตัวอย่าง จะได้ไฟล์ PDF บันทึกส่งใน LINE ได้ทันที</li>
              </ol>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleCopyLine}
                className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {isCopiedLine ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>คัดลอกสรุปส่ง LINE แล้ว!</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>หรือ คัดลอกสรุปยอดเพื่อส่งใน LINE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
