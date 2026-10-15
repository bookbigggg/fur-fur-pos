"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { 
  Search, 
  Receipt, 
  Scissors, 
  ShoppingBag, 
  Ticket, 
  ShieldCheck, 
  Banknote, 
  QrCode, 
  Clock, 
  Calendar,
  Loader2,
  Ban,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { 
  getRecentOrders, 
  getOrderDetail, 
  getDailySummary, 
  voidOrder,
  OrderSummaryItem, 
  OrderDetailResult, 
  DailySummaryMetrics 
} from "@/app/actions/orders";
import ReceiptModal from "@/components/orders/ReceiptModal";

type FilterTab = "all" | "today" | "grooming" | "retail" | "package" | "voided";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "today", label: "วันนี้" },
  { id: "grooming", label: "Grooming" },
  { id: "retail", label: "สินค้าปลีก" },
  { id: "package", label: "คูปอง/สมาชิก" },
  { id: "voided", label: "บิลยกเลิก" },
];

const QUICK_VOID_REASONS = [
  "คีย์ยอดเงิน / ราคาผิด",
  "ลูกค้าเปลี่ยนใจ / ขอยกเลิก",
  "เลือกช่องทางชำระเงินผิด",
  "เปิดบิลซ้ำซ้อน",
  "ลูกค้าขอเปลี่ยนบริการ",
];

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function getOrderDisplayTitle(ord: OrderSummaryItem): string {
  if (ord.order_type === "retail" && ord.retail_items && ord.retail_items.length > 0) {
    const firstItem = ord.retail_items[0];
    if (ord.retail_items.length === 1) {
      return `${firstItem.product_name} (${firstItem.quantity} ชิ้น)`;
    }
    return `${firstItem.product_name} x ${firstItem.quantity} (+ อีก ${ord.retail_items.length - 1} รายการ)`;
  }
  if (ord.order_type === "grooming") {
    return ord.service_description?.replace(/^\[VOID:[^\]]+\]\s*/, "") || "บริการ Grooming";
  }
  if (ord.order_type === "membership") {
    return ord.service_description?.replace(/^\[VOID:[^\]]+\]\s*/, "") || "สมัคร/ต่ออายุสมาชิกรายปี 299";
  }
  if (ord.order_type === "coupon") {
    return ord.service_description?.replace(/^\[VOID:[^\]]+\]\s*/, "") || "ซื้อแพ็กเกจคูปอง";
  }
  return ord.service_description || "รายการคำสั่งซื้อ";
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<OrderSummaryItem[]>([]);
  const [metrics, setMetrics] = useState<DailySummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [, startTransition] = useTransition();

  // Receipt Modal State
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetailResult | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  // Void Modal State
  const [orderToVoid, setOrderToVoid] = useState<OrderSummaryItem | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState(QUICK_VOID_REASONS[0]);
  const [customVoidReason, setCustomVoidReason] = useState("");
  const [isVoidPending, startVoidTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async (tab = activeTab, search = searchTerm) => {
    setLoading(true);
    const today = getBangkokDate();

    const filters = {
      date: tab === "today" ? today : undefined,
      type: tab === "all" || tab === "today" || tab === "voided" ? undefined : tab,
      search: search.trim() || undefined,
    };

    const [ordersData, metricsData] = await Promise.all([
      getRecentOrders(filters),
      getDailySummary(today),
    ]);

    // กรองเฉพาะบิลที่ยกเลิกเมื่อเลือกแท็บ voided
    let finalOrders = ordersData;
    if (tab === "voided") {
      finalOrders = ordersData.filter((o) => o.isVoided);
    }

    setOrders(finalOrders);
    setMetrics(metricsData);
    setLoading(false);
  }, [activeTab, searchTerm]);

  // Initial load
  useEffect(() => {
    let ignore = false;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

    Promise.all([getRecentOrders(), getDailySummary(today)]).then(([ordersData, metricsData]) => {
      if (!ignore) {
        setOrders(ordersData);
        setMetrics(metricsData);
        setLoading(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Handle Tab Switch
  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    startTransition(() => {
      loadData(tab, searchTerm);
    });
  };

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
  };

  // Trigger search on Enter or blur
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      loadData(activeTab, searchTerm);
    });
  };

  // View Receipt
  const handleOpenReceipt = async (orderId: string) => {
    setLoadingOrderId(orderId);
    const detail = await getOrderDetail(orderId);
    setLoadingOrderId(null);

    if (detail) {
      setSelectedOrderDetail(detail);
      setIsReceiptOpen(true);
    }
  };

  // Open Void Modal
  const handlePromptVoid = (ord: OrderSummaryItem) => {
    setOrderToVoid(ord);
    setVoidReason(QUICK_VOID_REASONS[0]);
    setCustomVoidReason("");
    setFeedbackMessage(null);
    setIsVoidModalOpen(true);
  };

  // Confirm Void Order
  const handleConfirmVoid = () => {
    if (!orderToVoid) return;
    const finalReason = customVoidReason.trim() || voidReason;

    startVoidTransition(async () => {
      const res = await voidOrder({
        orderId: orderToVoid.id,
        reason: finalReason,
        voidedBy: "แคชเชียร์",
      });

      if (res.success) {
        setIsVoidModalOpen(false);
        setFeedbackMessage({
          type: "success",
          text: `ยกเลิกบิล ${orderToVoid.order_number} เรียบร้อยแล้ว (ยอดเงินถูก Rollback คืนระบบ)`,
        });
        setOrderToVoid(null);
        loadData(activeTab, searchTerm);
      } else {
        setFeedbackMessage({
          type: "error",
          text: res.error || "ไม่สามารถยกเลิกบิลได้ กรุณาลองใหม่",
        });
      }
    });
  };

  const getTypeInfo = (orderType: string) => {
    switch (orderType) {
      case "grooming":
        return { label: "Grooming", icon: Scissors, badgeBg: "bg-amber-50 text-amber-800 border-amber-200" };
      case "retail":
        return { label: "สินค้าปลีก", icon: ShoppingBag, badgeBg: "bg-blue-50 text-blue-800 border-blue-200" };
      case "membership":
        return { label: "สมาชิก 299", icon: ShieldCheck, badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "coupon":
        return { label: "คูปอง", icon: Ticket, badgeBg: "bg-purple-50 text-purple-800 border-purple-200" };
      default:
        return { label: "ทั่วไป", icon: Scissors, badgeBg: "bg-stone-50 text-stone-700 border-stone-200" };
    }
  };

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-800 flex flex-col pb-24 font-sans">
      {/* Top Navbar */}
      <Navbar 
        subtitle="ประวัติบิล & สลิป"
        onRefresh={() => loadData(activeTab, searchTerm)}
        isRefreshing={loading}
      />

      {/* Main Container */}
      <main className="p-4 max-w-xl mx-auto w-full space-y-4 flex-1">
        
        {/* Daily Summary Metrics Banner */}
        <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-stone-600 pb-2 border-b border-stone-100">
            <span className="flex items-center gap-1.5 text-stone-800">
              <Calendar className="w-4 h-4 text-amber-600" />
              สรุปยอดขายประจำวันนี้ (ไม่รวมบิลยกเลิก)
            </span>
            <span className="text-[11px] text-stone-400 font-normal">
              {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase block">ยอดขายสุทธิวันนี้</span>
              <span className="text-2xl font-black text-stone-950 mt-0.5 block leading-tight">
                ฿{(metrics?.totalSales || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-stone-500">
                บิลสำเร็จ {(metrics?.orderCount || 0)} บิล
              </span>
            </div>

            <div className="border-l border-stone-100 pl-3 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-blue-600" /> โอน/QR:
                </span>
                <span className="font-bold text-stone-800">
                  ฿{(metrics?.transferQrTotal || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-500 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> เงินสด:
                </span>
                <span className="font-bold text-stone-800">
                  ฿{(metrics?.cashTotal || 0).toLocaleString()}
                </span>
              </div>
              {Number(metrics?.couponDeductedTotal) > 0 && (
                <div className="flex justify-between items-center text-xs pt-0.5 border-t border-stone-100">
                  <span className="text-amber-700 flex items-center gap-1 text-[11px]">
                    <Ticket className="w-3 h-3 text-amber-600" /> หักคูปอง:
                  </span>
                  <span className="font-bold text-amber-800 text-[11px]">
                    -฿{(metrics?.couponDeductedTotal || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <section className="space-y-2.5">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="ค้นหาเลขที่บิล, ชื่อน้อง, ชื่อลูกค้า หรือเบอร์โทร..."
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full text-base sm:text-xs pl-9 pr-20 py-2.5 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white shadow-sm"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 min-h-[34px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              ค้นหา
            </button>
          </form>

          {/* Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer active:scale-95 ${
                  activeTab === tab.id
                    ? tab.id === "voided" 
                      ? "bg-rose-900 text-white border-rose-900 shadow-sm"
                      : "bg-stone-900 text-white border-stone-900 shadow-sm"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 active:bg-stone-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Orders List */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-stone-700">
              รายการบิล ({orders.length} รายการ)
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-10 border border-stone-200 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
              <p className="text-xs text-stone-500">กำลังโหลดรายการคำสั่งซื้อ...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-stone-200 text-center space-y-2">
              <Receipt className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-xs font-bold text-stone-700">ไม่พบบิลคำสั่งซื้อ</p>
              <p className="text-[11px] text-stone-400">ลองเปลี่ยนคำค้นหาหรือเลือกแท็บอื่น</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((ord) => {
                const typeInfo = getTypeInfo(ord.order_type);
                const TypeIcon = typeInfo.icon;
                const timeText = ord.created_at
                  ? new Date(ord.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                  : "";
                const isVoided = ord.isVoided;
                const displayTitle = getOrderDisplayTitle(ord);

                return (
                  <div
                    key={ord.id}
                    className={`rounded-2xl p-4 border shadow-sm space-y-3 transition-all ${
                      isVoided 
                        ? "bg-rose-50/25 border-rose-200/80 opacity-80" 
                        : "bg-white border-stone-200/90 hover:border-amber-300"
                    }`}
                  >
                    {/* 1. แถวบนสุด: สิ่งที่มาทำ/ของที่ขายไป (เด่นที่สุด) & ยอดชำระเงิน */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {/* Type Icon Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${typeInfo.badgeBg}`}
                          title={typeInfo.label}
                        >
                          <TypeIcon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* รายการบริการ หรือ สินค้าที่ขาย (ตัวหนา เด่น ชัดเจนที่สุด) */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className={`font-black text-sm sm:text-base leading-snug line-clamp-1 ${
                              isVoided ? "line-through text-stone-400" : "text-stone-900"
                            }`}>
                              {displayTitle}
                            </h3>
                            {isVoided && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                <Ban className="w-2.5 h-2.5 text-rose-600" />
                                VOID
                              </span>
                            )}
                          </div>

                          {/* ข้อมูลสัตว์เลี้ยง / ลูกค้า */}
                          <p className="text-xs text-stone-600 mt-0.5 truncate">
                            {(() => {
                              const multiPetNames = Array.from(
                                ord.service_description?.matchAll(/\[([^\]]+)\]/g) || []
                              )
                                .map((m) => m[1])
                                .filter((n) => n !== "VOID" && !n.startsWith("VOID:"));

                              if (multiPetNames.length > 1) {
                                return (
                                  <span>
                                    <strong className="text-stone-850 font-bold">
                                      {multiPetNames.map((n) => `น้อง${n}`).join(" & ")}
                                    </strong>
                                    {ord.customer?.name && (
                                      <span className="text-stone-400"> • {ord.customer.name}</span>
                                    )}
                                  </span>
                                );
                              }

                              if (ord.pet) {
                                return (
                                  <span>
                                    <strong className="text-stone-850 font-bold">น้อง{ord.pet.name}</strong>
                                    <span className="text-stone-500"> ({ord.pet.species}{ord.pet.breed ? ` • ${ord.pet.breed}` : ""})</span>
                                    {ord.customer?.name && (
                                      <span className="text-stone-400"> • {ord.customer.name}</span>
                                    )}
                                  </span>
                                );
                              }

                              if (ord.customer?.name) {
                                return (
                                  <span>
                                    <strong className="text-stone-850 font-bold">{ord.customer.name}</strong>
                                    {ord.customer.phone && <span className="text-stone-500"> ({ord.customer.phone})</span>}
                                  </span>
                                );
                              }

                              return <span className="text-stone-400">ลูกค้าหน้าร้าน (Walk-in)</span>;
                            })()}
                          </p>
                        </div>
                      </div>

                      {/* ยอดชำระสุทธิ */}
                      <div className="text-right shrink-0">
                        <span className={`text-base sm:text-lg font-black block leading-tight ${
                          isVoided ? "line-through text-rose-400" : "text-stone-950"
                        }`}>
                          ฿{Number(ord.net_paid).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 mt-0.5">
                          {ord.payment_method === "เงินสด" ? (
                            <Banknote className="w-3 h-3 text-emerald-600" />
                          ) : ord.payment_method === "หักคูปอง" ? (
                            <Ticket className="w-3 h-3 text-amber-600" />
                          ) : (
                            <QrCode className="w-3 h-3 text-blue-600" />
                          )}
                          <span>{ord.payment_method}</span>
                        </span>
                      </div>
                    </div>

                    {/* 2. รายละเอียดสินค้าปลีกเพิ่มเติม (กรณีมีหลายชิ้น หรือเป็นบิลพ่วงกรูมมิ่ง) */}
                    {ord.retail_items && ord.retail_items.length > 1 && (
                      <div className="bg-stone-50 rounded-xl p-2 px-3 border border-stone-100 text-[11px] text-stone-600 space-y-0.5">
                        <span className="text-[10px] font-bold text-stone-400 block">สินค้าปลีก ({ord.retail_items.length} รายการ):</span>
                        {ord.retail_items.map((item, idx) => (
                          <div key={item.id || idx} className="flex justify-between items-center text-stone-700">
                            <span className="truncate pr-2">• {item.product_name} x {item.quantity}</span>
                            <span className="font-semibold shrink-0">฿{Number(item.total_price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* หมายเหตุการ Void (ถ้ามี) */}
                    {isVoided && ord.void_reason && (
                      <div className="p-2 bg-rose-50 rounded-xl border border-rose-200/80 text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
                        <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>เหตุผลที่ยกเลิก: {ord.void_reason}</span>
                      </div>
                    )}

                    {/* 3. แถวล่าง: ข้อมูลอ้างอิงบิล & เวลา & ปุ่มการทำงาน */}
                    <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                        <span className="font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-stone-200/70">
                          #{ord.order_number}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-stone-500">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {ord.order_date} {timeText && `(${timeText} น.)`}
                        </span>
                        {ord.discount_text && ord.discount_text !== "0%" && !ord.discount_text.includes("[VOID]") && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70">
                            ลด {ord.discount_text}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => handlePromptVoid(ord)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-200 px-2 py-1 rounded-lg transition-all cursor-pointer"
                            title="ยกเลิกบิลคำสั่งซื้อนี้"
                          >
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Void</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(ord.id)}
                          disabled={loadingOrderId === ord.id}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 px-2.5 py-1 rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          {loadingOrderId === ord.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5 text-amber-700" />
                          )}
                          <span>ดูสลิป</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Void Confirmation Modal */}
      {isVoidModalOpen && orderToVoid && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsVoidModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            <div className="px-5 py-3.5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-rose-950 leading-tight">
                    ยืนยันยกเลิกบิล (Void Bill)
                  </h3>
                  <p className="text-[10px] text-rose-700 font-mono font-bold">{orderToVoid.order_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="w-8 h-8 rounded-full bg-rose-100/80 hover:bg-rose-200 text-rose-700 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">ประเภทบิล:</span>
                  <span className="font-bold text-stone-800">{getTypeInfo(orderToVoid.order_type).label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">ยอดชำระ:</span>
                  <span className="font-black text-rose-700">฿{Number(orderToVoid.net_paid).toLocaleString()}</span>
                </div>
                {Number(orderToVoid.coupon_deducted) > 0 && (
                  <div className="flex justify-between text-amber-800 text-[11px]">
                    <span>ยอดหักคูปอง:</span>
                    <span>฿{Number(orderToVoid.coupon_deducted).toLocaleString()} (จะโอนคืนกลับให้ลูกค้า)</span>
                  </div>
                )}
              </div>

              {/* Warning Text */}
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-800 text-[11px] leading-relaxed space-y-1">
                <p className="font-bold">⚠️ การดำเนินการเมื่อกดยืนยัน:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-700 text-[10px]">
                  <li>ยอดเงินของบิลนี้จะไม่ถูกนำไปคำนวณในยอดขาย และยอดปิดกะประจำวัน</li>
                  <li>หากเป็นบิล Grooming ที่ตัดคูปอง ยอดเงินจะถูก Rollback คืนเข้ากระเป๋าคูปองของลูกค้าทันที</li>
                  <li>หากเป็นสินค้าฝากขาย รายการจะถูกตัดออกจากรอบเคลียร์เงินคู่ค้า</li>
                </ul>
              </div>

              {/* Select Reason */}
              <div className="space-y-1.5">
                <label className="font-semibold text-stone-700 block">
                  ระบุสาเหตุการยกเลิกบิล *
                </label>
                <div className="space-y-1">
                  {QUICK_VOID_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setVoidReason(r);
                        setCustomVoidReason("");
                      }}
                      className={`w-full text-left px-3.5 py-2.5 min-h-[38px] rounded-xl border text-xs font-medium transition-all cursor-pointer active:scale-[0.99] ${
                        voidReason === r && !customVoidReason
                          ? "bg-rose-50 text-rose-900 border-rose-300 font-bold shadow-xs"
                          : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 active:bg-stone-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={customVoidReason}
                  onChange={(e) => setCustomVoidReason(e.target.value)}
                  placeholder="หรือพิมพ์ระบุสาเหตุอื่นๆ..."
                  autoCorrect="off"
                  enterKeyHint="done"
                  className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs mt-1 bg-stone-50/50"
                />
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 active:bg-stone-200 transition-colors cursor-pointer active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isVoidPending}
                onClick={handleConfirmVoid}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isVoidPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังยกเลิกบิล...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>ยืนยันยกเลิกบิล</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal Component */}
      <ReceiptModal
        order={selectedOrderDetail}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
