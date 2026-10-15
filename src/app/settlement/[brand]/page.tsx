import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, FileText } from "lucide-react";
import { getBrandSettlementDetail } from "@/app/actions/settlement";
import PrintButton from "@/components/settlement/PrintButton";
import { STORE_PROFILE } from "@/lib/store-profile";

interface SettlementPageProps {
  params: Promise<{ brand: string }>;
  searchParams: Promise<{ period?: string }>;
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
  });

  return (
    <div className="min-h-dvh bg-stone-100 py-6 px-4 print:p-0 print:py-0 print:px-0 print:bg-white text-stone-900 font-sans">
      {/* Print Stylesheet กำหนดให้พิมพ์ A4 พอดี 1 หน้า ไม่ล้น และซ่อน header/footer ของเบราว์เซอร์ (URL http://) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');
          
          * {
            font-family: 'Google Sans', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif !important;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }
          @media print {
            * {
              font-family: 'Google Sans', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
            .a4-sheet {
              box-shadow: none !important;
              border: none !important;
              padding: 10mm 12mm !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              height: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `,
        }}
      />

      {/* แถบเครื่องมือด้านบน (ซ่อนอัตโนมัติตอนกดพิมพ์) */}
      <div className="max-w-[210mm] mx-auto mb-4 flex items-center justify-between no-print">
        <Link
          href={data.periodKey ? `/settlement?period=${encodeURIComponent(data.periodKey)}` : "/settlement"}
          className="inline-flex items-center min-h-[44px] gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-3.5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>กลับหน้ารายการ</span>
        </Link>

        <PrintButton statementNumber={data.statementNumber} />
      </div>

      {/* แผ่นกระดาษ A4 (ปรับ padding & spacing ให้พอดี 1 หน้าเมื่อบันทึกเป็น PDF) */}
      <main className="a4-sheet max-w-[210mm] mx-auto bg-white p-6 md:p-8 shadow-lg print:shadow-none print:p-0 border border-stone-200 print:border-none rounded-2xl print:rounded-none flex flex-col justify-between box-border">
        <div className="space-y-4 print:space-y-3">
          {/* Header เอกสาร */}
          <header className="border-b border-stone-200 pb-3.5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-base overflow-hidden border border-amber-200">
                  <span className="font-black">FF&</span>
                </div>
                <div>
                  <h1 className="text-xl font-black text-stone-900 leading-tight">
                    {STORE_PROFILE.name}
                  </h1>
                  <p className="text-[12px] font-bold text-stone-600">{STORE_PROFILE.nameTh}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-amber-900 mt-1 leading-tight">
                สาขา: {STORE_PROFILE.branch}
              </p>
              <p className="text-[9px] text-stone-500 leading-tight mt-0.5">
                {STORE_PROFILE.address}
              </p>
              <p className="text-[9px] text-stone-500 mt-0.5">
                โทร: {STORE_PROFILE.phone} • LINE: {STORE_PROFILE.lineId}
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md border uppercase ${
                isCleared 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                ใบสรุปยอดสินค้าฝากขาย {isCleared ? "(ชำระเงินเรียบร้อยแล้ว ✓)" : "(รอโอนเงิน)"}
              </span>
              <p className="text-xs font-mono font-bold text-stone-700 pt-0.5">
                เลขที่: {data.statementNumber}
              </p>
              <p className="text-[10px] text-stone-500">
                วันที่ออกเอกสาร: {issueDateStr}
              </p>
            </div>
          </header>

          {/* ข้อมูลคู่ค้าและรอบบัญชี */}
          <section className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                คู่ค้า / แบรนด์สินค้า (Consignee)
              </span>
              <p className="text-sm font-extrabold text-stone-900 mt-0.5">{data.brandGroup}</p>
              <p className="text-[11px] text-stone-500 mt-0.5">ประเภท: สินค้าฝากขายหน้าร้าน</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">
                รอบสรุปยอดบัญชี (Period)
              </span>
              <p className="text-xs font-bold text-amber-800 mt-0.5">{data.periodText}</p>
              <p className={`text-[11px] font-bold mt-0.5 ${isCleared ? "text-emerald-700" : "text-amber-700"}`}>
                สถานะ: {isCleared ? "เคลียร์ยอดโอนเงินเรียบร้อยแล้ว ✓" : "รอตัดรอบโอนเงิน"}
              </p>
            </div>
          </section>

          {/* สรุปตัวเลข 3 กล่อง */}
          <section className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl border border-stone-200 bg-white">
              <span className="text-[10px] text-stone-500 block font-semibold">1. ยอดขายหน้าร้านรวม</span>
              <span className="text-base font-black text-stone-900">฿{data.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">{data.totalQuantity} ชิ้น</span>
            </div>
            <div className="p-3 rounded-xl border border-stone-200 bg-white">
              <span className="text-[10px] text-stone-500 block font-semibold">2. ส่วนแบ่งร้าน (GP)</span>
              <span className="text-base font-black text-stone-700">฿{data.totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-stone-400 block mt-0.5">หักส่วนแบ่งร้านตามตกลง</span>
            </div>
            <div className={`p-3 rounded-xl border ${isCleared ? "border-emerald-300 bg-emerald-50/70" : "border-amber-300 bg-amber-50/70"}`}>
              <span className={`text-[10px] block font-bold ${isCleared ? "text-emerald-800" : "text-amber-800"}`}>
                3. {isCleared ? "ยอดสุทธิที่โอนคู่ค้าแล้ว" : "ยอดสุทธิที่ต้องโอนคู่ค้า"}
              </span>
              <span className={`text-base font-black ${isCleared ? "text-emerald-800" : "text-amber-800"}`}>
                ฿{data.totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`text-[10px] font-medium block mt-0.5 ${isCleared ? "text-emerald-700" : "text-amber-700"}`}>
                {isCleared ? "โอนเงินเรียบร้อยแล้ว" : "ยอดเงินที่ต้องโอนเข้าบัญชี"}
              </span>
            </div>
          </section>

          {/* ตารางแสดงรายการสินค้าย่อย */}
          <section className="space-y-1.5">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              รายการสินค้าที่จำหน่ายได้ (Sales Breakdown)
            </h3>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3">รายการสินค้า</th>
                    <th className="py-2 px-2 text-center w-14">จำนวน</th>
                    <th className="py-2 px-3 text-right w-20">ราคาขาย</th>
                    <th className="py-2 px-3 text-right w-24">ยอดขายรวม</th>
                    <th className="py-2 px-2 text-center w-14">% GP</th>
                    <th className="py-2 px-3 text-right w-24 font-bold text-amber-800">ยอดโอนคืน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-800">
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-stone-400">
                        ไม่มีรายการขายสินค้าฝากขายในรอบนี้
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-stone-50/50">
                        <td className="py-1.5 px-3 text-center text-stone-400 font-mono">{index + 1}</td>
                        <td className="py-1.5 px-3 font-medium">
                          <div>{item.product_name}</div>
                          <span className="text-[9px] text-stone-400">
                            {new Date(item.created_at).toLocaleDateString("th-TH")}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold">{item.quantity}</td>
                        <td className="py-1.5 px-3 text-right">฿{Number(item.unit_price).toLocaleString()}</td>
                        <td className="py-1.5 px-3 text-right font-medium">฿{Number(item.total_price).toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-center font-mono text-[10px] text-stone-500">
                          {Math.round(item.gp_rate * 100)}%
                        </td>
                        <td className="py-1.5 px-3 text-right font-bold text-amber-800">
                          ฿{Number(item.remit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-100/70 border-t border-stone-300 font-black text-stone-900">
                    <td colSpan={2} className="py-2 px-3 text-right">รวมทั้งสิ้น</td>
                    <td className="py-2 px-2 text-center">{data.totalQuantity} ชิ้น</td>
                    <td></td>
                    <td className="py-2 px-3 text-right">฿{data.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td></td>
                    <td className="py-2 px-3 text-right text-amber-800 text-xs">
                      ฿{data.totalRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        {/* Footer หมายเหตุ & ข้อมูลบัญชีร้าน & ช่องลงลายมือชื่อ (กระชับพอดี 1 หน้า A4) */}
        <footer className="pt-3 border-t border-stone-200 mt-3 space-y-2.5 print:pt-2 print:mt-2 print:space-y-2">
          {/* ข้อมูลบัญชีร้าน Fur Fur & และหมายเหตุ */}
          <div className="bg-stone-50/90 p-2.5 rounded-xl border border-stone-200/80 flex items-center justify-between gap-4 text-[9.5px] leading-relaxed">
            <div className="flex items-center gap-3">
              {/* QR Image ขนาดกะทัดรัด พร้อมพิมพ์ */}
              <div className="relative w-12 h-12 bg-white rounded-lg p-1 border border-stone-200 shrink-0 shadow-2xs">
                <img
                  src={STORE_PROFILE.bank.qrImageUrl}
                  alt="QR Code รับชำระเงิน Fur Fur &"
                  className="w-full h-full object-contain rounded"
                />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-stone-800 block text-[10px]">
                  🏦 ข้อมูลบัญชีร้าน {STORE_PROFILE.nameTh} ({STORE_PROFILE.name}):
                </span>
                <p className="text-stone-700">
                  {STORE_PROFILE.bank.bankName} • เลขที่บัญชี: <strong className="font-mono text-stone-900 font-bold">{STORE_PROFILE.bank.accountNumber}</strong>
                </p>
                <p className="text-stone-500">
                  ชื่อบัญชี: {STORE_PROFILE.bank.accountName} • สาขา {STORE_PROFILE.branch}
                </p>
              </div>
            </div>

            <div className="text-right text-stone-400 text-[9px] max-w-[220px] hidden sm:block print:block leading-tight">
              <strong>หมายเหตุ:</strong> เอกสารฉบับนี้ออกโดยระบบ Fur Fur & POS เพื่อใช้เป็นหลักฐานสรุปยอดขายสินค้าฝากขายและยอดโอนชำระคืน
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-center text-xs pt-1">
            {/* ฝั่งผู้จัดการร้าน (ฝังลายเซ็นฟาริ บุญเย็น) */}
            <div className="flex flex-col items-center">
              <p className="text-stone-500 text-[11px] font-medium mb-0.5">ผู้จัดการร้าน (Fur Fur &)</p>
              <div className="relative w-48 flex flex-col items-center">
                {/* ลายเซ็นฟาริ วางพาดเหนือเส้นบรรทัด */}
                <div className="h-12 flex items-end justify-center mb-[-6px] z-10">
                  <Image
                    src="/signatures/fari-signature.png"
                    alt="ลายเซ็น ฟาริ บุญเย็น"
                    width={130}
                    height={60}
                    className="h-12 w-auto object-contain select-none"
                    priority
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
              <p className="text-stone-500 text-[11px] font-medium mb-0.5">ผู้รับเงิน / ตัวแทนแบรนด์ ({data.brandGroup})</p>
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
      </main>
    </div>
  );
}
