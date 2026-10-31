import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, FileText } from "lucide-react";
import { getBrandSettlementDetail } from "@/app/actions/settlement";
import PrintButton from "@/components/settlement/PrintButton";
import A4PreviewWrapper from "@/components/settlement/A4PreviewWrapper";
import { STORE_PROFILE } from "@/lib/store-profile";
import { OrderRetailItem } from "@/types/database";

interface SettlementPageProps {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ period?: string }>;
}

const SINGLE_PAGE_MAX_ITEMS = 14;
const INTERMEDIATE_PAGE_MAX_ITEMS = 18;

interface StatementPageChunk {
  items: OrderRetailItem[];
  startIndex: number;
  pageNumber: number;
  totalPages: number;
  isFirst: boolean;
  isLast: boolean;
}

function paginateStatementItems(allItems: OrderRetailItem[]): StatementPageChunk[] {
  if (allItems.length <= SINGLE_PAGE_MAX_ITEMS) {
    return [
      {
        items: allItems,
        startIndex: 0,
        pageNumber: 1,
        totalPages: 1,
        isFirst: true,
        isLast: true,
      },
    ];
  }

  const rawChunks: { items: OrderRetailItem[]; startIndex: number }[] = [];
  let cursor = 0;

  while (cursor < allItems.length) {
    const remaining = allItems.length - cursor;

    if (remaining <= SINGLE_PAGE_MAX_ITEMS) {
      rawChunks.push({
        items: allItems.slice(cursor, cursor + remaining),
        startIndex: cursor,
      });
      cursor += remaining;
    } else if (remaining <= INTERMEDIATE_PAGE_MAX_ITEMS) {
      // แบ่งให้หน้าสุดท้ายมีอย่างน้อย 4 รายการ เพื่อไม่ให้ส่วนสรุปยอดและลายเซ็นลอยเดี่ยวบนหน้า 2
      const firstCount = Math.max(10, remaining - 5);
      rawChunks.push({
        items: allItems.slice(cursor, cursor + firstCount),
        startIndex: cursor,
      });
      cursor += firstCount;
    } else {
      rawChunks.push({
        items: allItems.slice(cursor, cursor + INTERMEDIATE_PAGE_MAX_ITEMS),
        startIndex: cursor,
      });
      cursor += INTERMEDIATE_PAGE_MAX_ITEMS;
    }
  }

  const totalPages = rawChunks.length;
  return rawChunks.map((chunk, idx) => ({
    items: chunk.items,
    startIndex: chunk.startIndex,
    pageNumber: idx + 1,
    totalPages,
    isFirst: idx === 0,
    isLast: idx === totalPages - 1,
  }));
}

function formatShortThaiDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return "";
  }
}

export async function generateMetadata({ params, searchParams }: SettlementPageProps): Promise<Metadata> {
  const { brand } = await params;
  const { period } = await searchParams;
  const decodedBrand = decodeURIComponent(brand);
  const data = await getBrandSettlementDetail(brand, period);
  const statementNumber = data?.statementNumber || `STL-${decodedBrand.toUpperCase()}`;

  return {
    title: `${statementNumber} - ใบสรุปยอดสินค้าฝากขาย Fur Fur &`,
  };
}

export default async function BrandSettlementStatementPage({ params, searchParams }: SettlementPageProps) {
  const { brand } = await params;
  const { period } = await searchParams;
  const data = await getBrandSettlementDetail(brand, period);

  if (!data) {
    return (
      <div className="min-h-dvh bg-stone-100 flex flex-col items-center justify-center p-4 text-center space-y-3 font-sans">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-stone-800">
          ไม่พบรายการขายของแบรนด์ &quot;{decodeURIComponent(brand)}&quot; {period ? `ในรอบ ${period}` : ""}
        </h2>
        <p className="text-xs text-stone-500">
          ไม่มีสินค้าฝากขายของแบรนด์นี้ที่จำหน่ายได้ในรอบเดือนนี้ จึงไม่ต้องออกใบสรุปยอด
        </p>
        <Link
          href={period ? `/settlement?period=${encodeURIComponent(period)}` : "/settlement"}
          className="text-xs font-bold text-amber-700 hover:underline pt-2 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> กลับหน้าภาพรวมการเคลียร์ยอด
        </Link>
      </div>
    );
  }

  const isCleared = data.status === "เคลียร์แล้ว";
  const issueDateStr = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });

  const pages = paginateStatementItems(data.items);

  return (
    <div className="min-h-dvh print:min-h-0 bg-stone-100 py-4 px-3 sm:py-6 sm:px-4 print:p-0 print:bg-white text-stone-900 font-sans">
      {/* Print & A4 Layout Stylesheet */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @page {
            size: A4 portrait;
            margin: 0;
          }
          .a4-page {
            font-size: 14px;
            line-height: 1.4;
          }
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .a4-preview-slot {
              width: 210mm !important;
              height: 297mm !important;
              max-height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .a4-preview-slot:not(:last-child) {
              page-break-after: always !important;
              break-after: page !important;
            }
            .a4-preview-slot:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .a4-preview-scaler {
              width: 210mm !important;
              height: 297mm !important;
              transform: none !important;
            }
            .a4-page {
              width: 210mm !important;
              height: 297mm !important;
              max-height: 297mm !important;
              padding: 10mm 12mm !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
            }
          }
        `,
        }}
      />

      {/* แถบเครื่องมือด้านบน (ซ่อนอัตโนมัติตอนพิมพ์) */}
      <div className="max-w-[794px] mx-auto mb-3 sm:mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 no-print">
        <Link
          href={data.periodKey ? `/settlement?period=${encodeURIComponent(data.periodKey)}` : "/settlement"}
          className="inline-flex items-center justify-center min-h-[42px] gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 px-3.5 py-2 rounded-xl shadow-2xs transition-all active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับหน้ารายการ</span>
        </Link>

        <PrintButton
          statementNumber={data.statementNumber}
          brandGroup={data.brandGroup}
          periodKey={data.periodKey || period}
          periodText={data.periodText}
          totalSales={data.totalSales}
          totalRemit={data.totalRemit}
          totalQuantity={data.totalQuantity}
          status={data.status}
        />
      </div>

      {/* แผ่นกระดาษ A4 (แบ่งหน้าอัตโนมัติ ไม่ล้น ไม่ตัดครึ่งตารางหรือลายเซ็น) */}
      <A4PreviewWrapper>
        {pages.map((page) => (
          <article
            key={page.pageNumber}
            className="a4-page w-[794px] h-[1123px] bg-white px-[44px] py-[36px] flex flex-col justify-between box-border select-text"
          >
            {/* ส่วนเนื้อหาด้านบนของหน้า */}
            <div className="space-y-3.5">
              {/* 1. Header เอกสาร */}
              <header className="border-b border-stone-200 pb-3 flex justify-between items-start gap-4">
                <div>
                  <div>
                    <h1 className="text-[19px] font-black text-stone-900 leading-tight">
                      {STORE_PROFILE.name}
                    </h1>
                    <p className="text-[12px] font-bold text-stone-600">{STORE_PROFILE.nameTh}</p>
                  </div>

                  <p className="text-[9.5px] text-stone-500 leading-snug mt-1">
                    {STORE_PROFILE.address}
                  </p>
                  <p className="text-[9.5px] text-stone-500 mt-0.5" suppressHydrationWarning>
                    โทร: {STORE_PROFILE.phone} • LINE: {STORE_PROFILE.lineId}
                  </p>
                </div>

                <div className="text-right space-y-0.5 shrink-0">
                  <span
                    className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md border uppercase ${
                      isCleared
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {isCleared ? "ใบสรุปยอดฝากขาย (ชำระเงินแล้ว ✓)" : "ใบสรุปยอดฝากขาย (รอโอนเงิน)"}
                  </span>
                  <p className="text-[12px] font-mono font-bold text-stone-700 pt-0.5">
                    เลขที่: {data.statementNumber}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    วันที่ออกเอกสาร: {issueDateStr}
                    {page.totalPages > 1 ? ` • หน้า ${page.pageNumber}/${page.totalPages}` : ""}
                  </p>
                </div>
              </header>

              {/* 2. ข้อมูลคู่ค้า & รอบสรุปยอด */}
              <section className="bg-stone-50/90 px-3.5 py-2.5 rounded-xl border border-stone-200 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[9.5px] text-stone-400 font-bold uppercase tracking-wider block">
                    คู่ค้า / แบรนด์สินค้า (Consignee)
                  </span>
                  <p className="text-[15px] font-extrabold text-stone-900 mt-0.5 leading-snug">
                    {data.brandGroup}
                  </p>
                  <p className="text-[10.5px] text-stone-500 mt-0.5">ประเภท: สินค้าฝากขายหน้าร้าน</p>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] text-stone-400 font-bold uppercase tracking-wider block">
                    รอบสรุปยอดบัญชี (Period)
                  </span>
                  <p className="text-[12.5px] font-bold text-amber-800 mt-0.5">{data.periodText}</p>
                  <p
                    className={`text-[10.5px] font-bold mt-0.5 ${
                      isCleared ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    สถานะ: {isCleared ? "โอนเงินเรียบร้อยแล้ว ✓" : "รอตัดรอบโอนเงิน"}
                  </p>
                </div>
              </section>

              {/* 3. ตารางแสดงรายการสินค้าย่อย (ขยายคอลัมน์รายการสินค้าให้กว้าง 41% อ่านง่ายในบรรทัดเดียว) */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold text-stone-800 uppercase tracking-wider">
                    รายการสินค้าที่จำหน่ายได้ในรอบเดือน
                  </h3>
                  <span className="text-[10px] text-stone-400 font-medium">
                    ทั้งหมด {data.items.length} รายการ ({data.totalQuantity} ชิ้น)
                  </span>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full table-fixed text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                        <th className="py-2 px-2 w-[5%] text-center">#</th>
                        <th className="py-2 px-3 w-[41%]">รายการสินค้า</th>
                        <th className="py-2 px-1.5 w-[8%] text-center">จำนวน</th>
                        <th className="py-2 px-2.5 w-[10%] text-right">ราคาขาย</th>
                        <th className="py-2 px-2.5 w-[11%] text-right">ยอดขายรวม</th>
                        <th className="py-2 px-2.5 w-[13%] text-right text-stone-600">ส่วนแบ่งร้าน (GP)</th>
                        <th className="py-2 px-3 w-[12%] text-right font-bold text-amber-800">ยอดโอนคืน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {page.items.map((item, idx) => {
                        const rowNum = page.startIndex + idx + 1;
                        return (
                          <tr key={item.id} className="hover:bg-stone-50/50">
                            <td className="py-1.5 px-2 text-center text-stone-400 font-mono text-[10.5px]">
                              {rowNum}
                            </td>
                            <td className="py-1.5 px-3 font-medium">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-stone-900 font-semibold leading-snug break-words">
                                  {item.product_name}
                                </span>
                                <span className="text-[9.5px] text-stone-400 font-normal whitespace-nowrap shrink-0">
                                  {formatShortThaiDate(item.created_at)}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-1.5 text-center font-bold">{item.quantity}</td>
                            <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                              ฿{Number(item.unit_price).toLocaleString()}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-medium whitespace-nowrap">
                              ฿{Number(item.total_price).toLocaleString()}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-stone-600 whitespace-nowrap">
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="text-[9px] text-stone-400 font-mono">
                                  ({Math.round(item.gp_rate * 100)}%)
                                </span>
                                <span>
                                  ฿
                                  {Number(item.shop_profit).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-amber-800 whitespace-nowrap">
                              ฿
                              {Number(item.remit_amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {page.isLast && (
                      <tfoot>
                        <tr className="bg-stone-100/90 border-t-2 border-stone-300 font-black text-stone-900">
                          <td colSpan={2} className="py-2 px-3 text-right">
                            รวมทั้งสิ้น
                          </td>
                          <td className="py-2 px-1.5 text-center text-stone-800">
                            {data.totalQuantity} ชิ้น
                          </td>
                          <td></td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            ฿{data.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-right text-stone-700 whitespace-nowrap">
                            ฿{data.totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-800 text-[11.5px] whitespace-nowrap">
                            ฿{data.totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>

              {/* 4. กล่องสรุปผลตัวเลขทางการเงิน (แสดงเฉพาะหน้าสุดท้าย จัดวางแนวนอนคงที่ตามสัดส่วน A4) */}
              {page.isLast && (
                <section className="flex flex-row justify-between items-center gap-4 pt-1">
                  {/* หมายเหตุการเคลียร์ยอด */}
                  <div className="text-[10px] text-stone-500 space-y-0.5 max-w-[360px] leading-relaxed">
                    <p className="font-bold text-stone-700">📌 บันทึกข้อกำหนด:</p>
                    <p>
                      เอกสารนี้สรุปยอดขายสินค้าฝากขายของแบรนด์ <strong>{data.brandGroup}</strong>{" "}
                      ประจำ{data.periodText} เพื่อใช้เป็นหลักฐานการโอนชำระเงินคืนสุทธิ
                    </p>
                  </div>

                  {/* บล็อกคำนวณยอดเงินสุทธิ (Math Breakdown) */}
                  <div className="w-[290px] shrink-0 bg-stone-50 rounded-xl p-3 border border-stone-200/90 space-y-1 text-[11.5px]">
                    <div className="flex justify-between items-center text-stone-600">
                      <span>ยอดขายสินค้ารวม ({data.totalQuantity} ชิ้น):</span>
                      <span className="font-semibold text-stone-900">
                        ฿{data.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-stone-600">
                      <span>หัก ส่วนแบ่งร้าน (GP):</span>
                      <span className="font-semibold text-rose-700">
                        -฿{data.totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-stone-300 flex justify-between items-baseline font-bold">
                      <span className="text-stone-900 font-extrabold text-[11px]">
                        ยอดสุทธิที่โอนคืนคู่ค้า:
                      </span>
                      <span className="text-[14px] font-black text-amber-800">
                        ฿{data.totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* 5. Footer ช่องลงลายมือชื่อ (หน้าสุดท้าย) หรือแจ้งมีต่อหน้าถัดไป */}
            {page.isLast ? (
              <footer className="pt-3 border-t border-stone-200 mt-2">
                <div className="grid grid-cols-2 gap-8 text-center text-xs pt-1">
                  {/* ฝั่งผู้จัดการร้าน (ฝังลายเซ็นฟาริ บุญเย็น) */}
                  <div className="flex flex-col items-center">
                    <p className="text-stone-500 text-[11px] font-medium mb-0.5">
                      ผู้จัดการร้าน (Fur Fur &)
                    </p>
                    <div className="relative w-48 flex flex-col items-center">
                      <div className="h-12 flex items-end justify-center mb-[-6px] z-10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/signatures/fari-signature.png"
                          alt="ลายเซ็น ฟาริ บุญเย็น"
                          width={130}
                          height={60}
                          className="h-12 w-auto object-contain select-none"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <div className="border-t border-stone-400 w-full pt-1.5 text-center">
                        <p className="font-bold text-stone-900 text-xs">( ฟาริ บุญเย็น )</p>
                        <p className="text-[10px] text-stone-500 mt-1 whitespace-nowrap">
                          วันที่:&nbsp;&nbsp;{issueDateStr}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ฝั่งตัวแทนแบรนด์คู่ค้า (เว้นบรรทัดสำหรับเซ็นรับเงินจริง) */}
                  <div className="flex flex-col items-center">
                    <p className="text-stone-500 text-[11px] font-medium mb-0.5">
                      ผู้รับเงิน / ตัวแทนแบรนด์ ({data.brandGroup})
                    </p>
                    <div className="relative w-48 flex flex-col items-center">
                      <div className="h-12 flex items-end justify-center mb-[-6px]">
                        {/* พื้นที่เว้นสำหรับลงลายมือชื่อจริง */}
                      </div>
                      <div className="border-t border-stone-400 w-full pt-1.5 text-center">
                        <p className="font-bold text-stone-800 text-xs whitespace-nowrap">
                          (&nbsp;..............................&nbsp;)
                        </p>
                        <p className="text-[10px] text-stone-500 mt-1 whitespace-nowrap">
                          วันที่:&nbsp;&nbsp;........ / ........ / ........
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            ) : (
              <footer className="pt-2.5 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-400 font-medium">
                <span>
                  {STORE_PROFILE.name} • ใบสรุปยอดฝากขาย {data.statementNumber}
                </span>
                <span>
                  มีรายการต่อหน้าถัดไป (หน้า {page.pageNumber} / {page.totalPages}) →
                </span>
              </footer>
            )}
          </article>
        ))}
      </A4PreviewWrapper>
    </div>
  );
}
