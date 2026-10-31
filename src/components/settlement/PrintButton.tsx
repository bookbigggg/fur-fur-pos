"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Printer,
  MessageCircle,
  Check,
  Share2,
  Download,
  Loader2,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface PrintButtonProps {
  statementNumber?: string;
  brandGroup?: string;
  periodKey?: string;
  periodText?: string;
  totalSales?: number;
  totalRemit?: number;
  totalQuantity?: number;
  status?: string;
}

export default function PrintButton({
  statementNumber,
  brandGroup,
  periodKey,
  periodText,
  totalSales,
  totalRemit,
  totalQuantity,
  status,
}: PrintButtonProps) {
  const [canShareFile, setCanShareFile] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [isCopiedLine, setIsCopiedLine] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const generatingPromiseRef = useRef<Promise<File | null> | null>(null);

  const fileName = `${statementNumber || `STL-${brandGroup || "STATEMENT"}`}.pdf`;

  // ตรวจสอบว่าอุปกรณ์รองรับ Web Share API สำหรับแชร์ไฟล์ PDF เข้า LINE โดยตรงหรือไม่ (iPhone / iPad / Android)
  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined") {
      try {
        const testFile = new File(["pdf"], "test.pdf", { type: "application/pdf" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [testFile] })) {
          setCanShareFile(true);
        }
      } catch {
        setCanShareFile(false);
      }
    }
  }, []);

  // ฟังก์ชันสร้างไฟล์ PDF ขนาด A4 จาก .a4-page ทุกหน้าในเอกสาร
  const buildPdfFile = useCallback(async (): Promise<File | null> => {
    if (pdfFileRef.current) {
      return pdfFileRef.current;
    }
    if (generatingPromiseRef.current) {
      return generatingPromiseRef.current;
    }

    const promise = (async () => {
      try {
        setIsGeneratingPdf(true);

        // รอให้ฟอนต์ภาษาไทยและรูปภาพลายเซ็นโหลดเสร็จสมบูรณ์
        if (typeof document !== "undefined" && "fonts" in document) {
          await document.fonts.ready;
        }

        const pageNodes = Array.from(
          document.querySelectorAll<HTMLElement>(".a4-page")
        );
        if (pageNodes.length === 0) return null;

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas-pro"),
          import("jspdf"),
        ]);

        // สร้าง offscreen container ขนาด A4 มาตรฐาน (794x1123px) ที่ไม่มี CSS transform scale
        // เพื่อให้ตารางและฟอนต์คมชัด 100% แม้กดสร้างจากหน้าจอมือถือขนาดเล็ก
        const stagingRoot = document.createElement("div");
        stagingRoot.style.position = "fixed";
        stagingRoot.style.left = "-10000px";
        stagingRoot.style.top = "0";
        stagingRoot.style.width = "794px";
        stagingRoot.style.background = "#ffffff";
        stagingRoot.style.zIndex = "-9999";
        stagingRoot.style.pointerEvents = "none";
        document.body.appendChild(stagingRoot);

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });

        try {
          for (let i = 0; i < pageNodes.length; i++) {
            const clone = pageNodes[i].cloneNode(true) as HTMLElement;
            clone.style.width = "794px";
            clone.style.minWidth = "794px";
            clone.style.maxWidth = "794px";
            clone.style.height = "1123px";
            clone.style.minHeight = "1123px";
            clone.style.maxHeight = "1123px";
            clone.style.transform = "none";
            clone.style.margin = "0";
            clone.style.boxShadow = "none";
            clone.style.borderRadius = "0";
            clone.style.border = "none";

            stagingRoot.innerHTML = "";
            stagingRoot.appendChild(clone);

            // รอให้รูปภาพใน clone พร้อมใช้งาน
            const imgs = Array.from(clone.querySelectorAll("img"));
            await Promise.all(
              imgs.map(
                (img) =>
                  new Promise<void>((resolve) => {
                    if (img.complete) {
                      resolve();
                    } else {
                      img.onload = () => resolve();
                      img.onerror = () => resolve();
                    }
                  })
              )
            );

            const canvas = await html2canvas(clone, {
              scale: 2.5,
              width: 794,
              height: 1123,
              windowWidth: 1024,
              useCORS: true,
              allowTaint: true,
              backgroundColor: "#ffffff",
              logging: false,
            });

            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            if (i > 0) {
              pdf.addPage("a4", "portrait");
            }
            pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
          }
        } finally {
          if (stagingRoot.parentNode) {
            stagingRoot.parentNode.removeChild(stagingRoot);
          }
        }

        const pdfBlob = pdf.output("blob");
        const generatedFile = new File([pdfBlob], fileName, {
          type: "application/pdf",
          lastModified: Date.now(),
        });

        pdfFileRef.current = generatedFile;
        setIsPdfReady(true);
        return generatedFile;
      } catch (err) {
        console.error("Failed to generate PDF:", err);
        return null;
      } finally {
        setIsGeneratingPdf(false);
        generatingPromiseRef.current = null;
      }
    })();

    generatingPromiseRef.current = promise;
    return promise;
  }, [fileName]);

  // Pre-generate ไฟล์ PDF ล่วงหน้าเมื่อเปิดหน้า เพื่อให้กดปุ่มแชร์เข้า LINE บน iOS/iPadOS ได้ทันทีแบบไม่ต้องรอ
  useEffect(() => {
    const timer = setTimeout(() => {
      void buildPdfFile();
    }, 350);
    return () => clearTimeout(timer);
  }, [buildPdfFile]);

  const triggerBrowserDownload = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  };

  // ปุ่มหลัก: ส่งไฟล์ PDF เข้า LINE / แชร์ไฟล์ (บน iOS, iPadOS, Android) หรือดาวน์โหลดโดยตรง
  const handleShareOrDownloadPdf = async () => {
    let file = pdfFileRef.current;
    if (!file) {
      file = await buildPdfFile();
    }
    if (!file) {
      // Fallback กรณีเกิดข้อผิดพลาดในการสร้างไฟล์
      window.print();
      return;
    }

    if (canShareFile && typeof navigator.share === "function") {
      try {
        await navigator.share({
          files: [file],
          title: `${statementNumber || "ใบสรุปยอดฝากขาย"} - ${brandGroup || ""}`,
        });
        return;
      } catch (err) {
        // กรณีผู้ใช้กดยกเลิกหน้าต่าง Share Sheet ไม่ต้องทำอะไรต่อ
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        // กรณี iOS หมดเวลา User Gesture เพราะเพิ่งสร้างไฟล์เสร็จ ให้แจ้งแตะซ้ำอีกครั้ง (ไฟล์พร้อมในหน่วยความจำแล้ว)
        if (err instanceof Error && err.name === "NotAllowedError") {
          setShareFeedback("ไฟล์พร้อมแล้ว แตะอีกครั้งเพื่อส่ง");
          setTimeout(() => setShareFeedback(null), 4000);
          return;
        }
      }
    }

    // บนคอมพิวเตอร์ หรือเบราว์เซอร์ที่ไม่รองรับ Web Share File ให้ดาวน์โหลดไฟล์ .pdf ทันที
    triggerBrowserDownload(file);
    setShareFeedback("ดาวน์โหลด PDF แล้ว!");
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // ปุ่มดาวน์โหลดไฟล์ .pdf ลงเครื่องโดยตรง
  const handleDirectDownload = async () => {
    const file = pdfFileRef.current || (await buildPdfFile());
    if (file) {
      triggerBrowserDownload(file);
      setShareFeedback("ดาวน์โหลด PDF แล้ว!");
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  // ข้อความสรุปยอดส่ง LINE (กระชับ สุภาพ ไม่แนบลิงก์ภายในระบบที่คู่ค้าเปิดไม่ได้)
  const generateLineText = () => {
    const displayPeriod = periodText
      ? periodText.replace(/^รอบประจำเดือน\s*/, "")
      : periodKey || "";

    return [
      `🐾 สรุปยอดขายสินค้าฝากขาย ร้าน Fur Fur &`,
      `แบรนด์: ${brandGroup || "คู่ค้าฝากขาย"}`,
      displayPeriod ? `รอบประจำเดือน: ${displayPeriod}` : "",
      statementNumber ? `เลขที่ใบสรุป: ${statementNumber}` : "",
      `--------------------------------`,
      totalQuantity !== undefined ? `• จำนวนที่ขายได้: ${totalQuantity} ชิ้น` : "",
      totalSales !== undefined
        ? `• ยอดขายรวม: ฿${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : "",
      totalRemit !== undefined
        ? `• ยอดโอนคืนสุทธิ: ฿${totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        : "",
      status ? `• สถานะ: ${status === "เคลียร์แล้ว" ? "โอนชำระเงินแล้ว ✓" : "รอตัดรอบโอนเงิน"}` : "",
      `--------------------------------`,
      `รายละเอียดตามไฟล์ใบสรุปยอด (PDF) ที่แนบมาพร้อมกันนี้นะคะ 🙏✨`,
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

  const handleDesktopPrint = () => {
    const originalTitle = document.title;
    if (statementNumber) {
      document.title = statementNumber;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* 1. ปุ่มหลัก: ส่งไฟล์ PDF เข้า LINE / บันทึกไฟล์ PDF (One-Tap Native Share) */}
      <button
        type="button"
        onClick={handleShareOrDownloadPdf}
        disabled={isGeneratingPdf && !isPdfReady}
        className="inline-flex items-center justify-center min-h-[42px] gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-70 px-3.5 py-2 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
      >
        {isGeneratingPdf && !isPdfReady ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังเตรียมไฟล์ PDF...</span>
          </>
        ) : shareFeedback ? (
          <>
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{shareFeedback}</span>
          </>
        ) : canShareFile ? (
          <>
            <Share2 className="w-4 h-4" />
            <span>ส่งไฟล์ PDF (LINE / บันทึก)</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลดไฟล์ PDF</span>
          </>
        )}
      </button>

      {/* 2. ปุ่มดาวน์โหลดตรง (แสดงเพิ่มเมื่ออยู่บนอุปกรณ์ที่ปุ่มหลักเป็นปุ่มแชร์) */}
      {canShareFile && (
        <button
          type="button"
          onClick={handleDirectDownload}
          disabled={isGeneratingPdf && !isPdfReady}
          className="inline-flex items-center justify-center min-h-[42px] gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
          title="ดาวน์โหลดไฟล์ PDF ลงเครื่อง"
        >
          <Download className="w-3.5 h-3.5 text-amber-700" />
          <span className="hidden sm:inline">ดาวน์โหลด PDF</span>
        </button>
      )}

      {/* 3. ปุ่มคัดลอกข้อความสรุปยอด (ไม่มีลิงก์แปลกๆ) */}
      <button
        type="button"
        onClick={handleCopyLine}
        className={`inline-flex items-center justify-center min-h-[42px] gap-1.5 text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer ${
          isCopiedLine
            ? "bg-emerald-700 text-white"
            : "bg-[#06C755] hover:bg-[#05b34c] text-white"
        }`}
        title="คัดลอกข้อความสรุปยอด (สำหรับส่งคู่กับไฟล์ PDF ใน LINE)"
      >
        {isCopiedLine ? (
          <>
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>คัดลอกข้อความแล้ว!</span>
          </>
        ) : (
          <>
            <MessageCircle className="w-3.5 h-3.5 fill-current" />
            <span>คัดลอกข้อความสรุป</span>
          </>
        )}
      </button>

      {/* 4. ปุ่มสั่งพิมพ์ออกเครื่องพิมพ์ (สำหรับคอมพิวเตอร์ / AirPrint) */}
      <button
        type="button"
        onClick={handleDesktopPrint}
        className="hidden sm:inline-flex items-center justify-center min-h-[42px] gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer"
        title="สั่งพิมพ์ออกเครื่องพิมพ์"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>พิมพ์</span>
      </button>
    </div>
  );
}
