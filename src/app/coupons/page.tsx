"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  Ticket, 
  Search, 
  PlusCircle, 
  Calendar, 
  Phone, 
  Copy, 
  Check, 
  Clock, 
  TrendingUp, 
  ArrowRight
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { getCouponsSummary } from "@/app/actions/coupons";
import { CouponWithDetails, CouponSummaryKPI } from "@/types/database";
import CouponHistoryModal from "@/components/coupons/CouponHistoryModal";
import { copyToClipboard } from "@/lib/clipboard";

type StatusFilter = "all" | "active" | "exhausted";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponWithDetails[]>([]);
  const [kpi, setKpi] = useState<CouponSummaryKPI>({
    totalCoupons: 0,
    activeCount: 0,
    exhaustedCount: 0,
    totalRemainingCredit: 0,
    totalPaidAmount: 0,
    totalPackageValue: 0,
    totalLiability: 0,
    totalUsedCredit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCoupon, setSelectedCoupon] = useState<CouponWithDetails | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await getCouponsSummary();
      if (res.success) {
        setCoupons(res.coupons);
        setKpi(res.kpi);
      }
    } catch (err) {
      console.error("Failed to load coupons summary:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // คัดลอกเบอร์โทรศัพท์
  const handleCopyPhone = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(phone);
    if (ok) {
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    }
  };

  // ตัวกรองค้นหา
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      // 1. กรองสถานะ
      if (statusFilter === "active") {
        if (c.status !== "ใช้งานได้" || Number(c.remaining_balance) <= 0) return false;
      } else if (statusFilter === "exhausted") {
        if (c.status === "ใช้งานได้" && Number(c.remaining_balance) > 0) return false;
      }

      // 2. กรองคำค้นหา
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const codeMatch = c.coupon_code?.toLowerCase().includes(q);
      const petNameMatch = c.pet?.name?.toLowerCase().includes(q);
      const custNameMatch = c.pet?.customer?.name?.toLowerCase().includes(q);
      const phoneMatch = c.pet?.customer?.phone?.replace(/-/g, "").includes(q.replace(/-/g, ""));
      const breedMatch = c.pet?.breed?.toLowerCase().includes(q);

      return codeMatch || petNameMatch || custNameMatch || phoneMatch || breedMatch;
    });
  }, [coupons, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans pb-16">
      <Navbar 
        subtitle="สรุปยอดคูปอง" 
        onRefresh={() => loadData(true)} 
        isRefreshing={refreshing} 
      />

      <main className="max-w-xl mx-auto w-full px-4 pt-4 space-y-4 flex-1">
        {/* Banner Quick Link - เปิดขายคูปองใหม่ */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block">
              TFRS 15 Package
            </span>
            <h2 className="text-sm font-black mt-1 leading-tight truncate">
              ระบบบริหารจัดการคูปองเงินสด
            </h2>
            <p className="text-[11px] text-amber-100/90 mt-0.5">
              ตรวจเช็กเครดิตคงเหลือ หนี้สินรับล่วงหน้า และประวัติการหักชำระ
            </p>
          </div>
          <Link
            href="/pos"
            className="shrink-0 bg-white hover:bg-amber-50 text-amber-900 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-700" />
            <span>เปิดบิลใหม่</span>
          </Link>
        </div>

        {/* KPI Summary Cards */}
        <section className="grid grid-cols-2 gap-2.5">
          {/* Card 1: เครดิตคงเหลือรวม */}
          <div className="bg-white rounded-2xl p-3.5 border border-amber-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-amber-600" />
                เครดิตคงเหลือรวม
              </span>
              <span className="text-[9px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                พร้อมใช้
              </span>
            </div>
            <p className="text-xl font-black text-amber-900 tracking-tight">
              ฿{kpi.totalRemainingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-stone-400">
              จากมูลค่าเต็ม ฿{kpi.totalPackageValue.toLocaleString()}
            </p>
          </div>

          {/* Card 2: หนี้สินค้างส่งมอบ TFRS 15 */}
          <div className="bg-white rounded-2xl p-3.5 border border-purple-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-800 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                หนี้สินค้างทางบัญชี
              </span>
              <span className="text-[9px] font-bold bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200">
                TFRS 15
              </span>
            </div>
            <p className="text-xl font-black text-purple-950 tracking-tight">
              ฿{kpi.totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-purple-600/80">
              ภาระส่งมอบบริการจริง
            </p>
          </div>

          {/* Card 3: คูปองใช้งานได้ */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-stone-500 block">
              สถานะคูปองทั้งหมด
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-emerald-700">
                {kpi.activeCount}
              </span>
              <span className="text-xs font-bold text-stone-400">
                / {kpi.totalCoupons} ใบ
              </span>
            </div>
            <p className="text-[10px] text-stone-400">
              ใช้หมดแล้ว {kpi.exhaustedCount} ใบ
            </p>
          </div>

          {/* Card 4: เงินสดรับจริงสะสม */}
          <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-stone-500 block">
              เงินสดรับเปิดคูปองสะสม
            </span>
            <p className="text-lg font-black text-stone-800 tracking-tight">
              ฿{kpi.totalPaidAmount.toLocaleString()}
            </p>
            <p className="text-[10px] text-stone-400">
              ใช้บริการตัดแล้ว ฿{kpi.totalUsedCredit.toLocaleString()}
            </p>
          </div>
        </section>

        {/* Search & Status Filters */}
        <section className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-3">
          {/* Search Input (16px font-size protection for iOS) */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ชื่อน้อง, รหัสคูปอง..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-base md:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stone-600 bg-stone-200/80 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              ทั้งหมด ({coupons.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-white text-emerald-800 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              ใช้งานได้ ({kpi.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("exhausted")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                statusFilter === "exhausted"
                  ? "bg-white text-stone-800 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              ใช้หมดแล้ว ({kpi.exhaustedCount})
            </button>
          </div>
        </section>

        {/* Coupons Directory List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-600" />
              <span>รายการคูปอง</span>
            </h3>
            <span className="text-[11px] text-stone-400 font-medium">
              พบ {filteredCoupons.length} รายการ
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center space-y-2 border border-stone-200/90 shadow-2xs">
              <div className="inline-block w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-stone-400 font-medium">กำลังโหลดข้อมูลคูปอง...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center space-y-3 border border-stone-200/90 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-stone-800">ไม่พบคูปองที่ตรงตามเงื่อนไข</p>
                <p className="text-xs text-stone-400 mt-0.5">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรองสถานะ</p>
              </div>
              {(searchQuery || statusFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCoupons.map((coupon) => {
                const pkgValue = Number(coupon.package_value) || 0;
                const remBalance = Number(coupon.remaining_balance) || 0;
                const paidAmount = Number(coupon.paid_amount) || 0;
                const bonus = Math.max(0, pkgValue - paidAmount);
                const percentRemaining = pkgValue > 0 ? Math.round((remBalance / pkgValue) * 100) : 0;
                const isActive = coupon.status === "ใช้งานได้" && remBalance > 0;

                const openDate = new Date(coupon.created_at).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <div
                    key={coupon.id}
                    onClick={() => setSelectedCoupon(coupon)}
                    className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer space-y-3 group"
                  >
                    {/* Header: Code & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-base border border-amber-200/60 shrink-0">
                          {coupon.pet?.species === "แมว" ? "🐱" : "🐶"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-stone-900 text-sm">
                              น้อง{coupon.pet?.name || "ไม่ระบุชื่อ"}
                            </span>
                            <span className="text-[10px] font-black bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full border border-stone-200">
                              {coupon.coupon_code || "CPN"}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {coupon.pet?.species || "สัตว์เลี้ยง"}
                            {coupon.pet?.breed && ` • ${coupon.pet.breed}`}
                            {coupon.pet?.weight_kg && ` (${coupon.pet.weight_kg} kg)`}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-stone-100 text-stone-600 border-stone-200"
                      }`}>
                        {isActive ? "ใช้งานได้" : "ใช้หมดแล้ว"}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-stone-50/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-stone-600 border border-stone-100">
                      <span className="truncate font-medium">
                        เจ้าของ: <span className="font-bold text-stone-800">{coupon.pet?.customer?.name || "ลูกค้าทั่วไป"}</span>
                      </span>

                      {coupon.pet?.customer?.phone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`tel:${coupon.pet.customer.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/70"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{coupon.pet.customer.phone}</span>
                          </a>

                          <button
                            type="button"
                            onClick={(e) => handleCopyPhone(coupon.pet!.customer!.phone!, e)}
                            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
                            title="คัดลอกเบอร์โทร"
                          >
                            {copiedPhone === coupon.pet.customer.phone ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Balance & Progress */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block">เครดิตคงเหลือ</span>
                          <span className="text-xl font-black text-amber-900 tracking-tight">
                            ฿{remBalance.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-stone-400 block">มูลค่าแพ็กเกจ</span>
                          <span className="text-xs font-extrabold text-stone-700">
                            ฿{pkgValue.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden border border-stone-200/60">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            percentRemaining > 20 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, percentRemaining))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                        <span>จ่ายจริง ฿{paidAmount.toLocaleString()} {bonus > 0 && `(คุ้มค่า +฿${bonus.toLocaleString()})`}</span>
                        <span className="font-bold text-stone-600">คงเหลือ {percentRemaining}%</span>
                      </div>
                    </div>

                    {/* Footer: Date & Transaction Action */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                      <span className="text-stone-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>เปิดเมื่อ {openDate}</span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCoupon(coupon);
                        }}
                        className="font-bold text-amber-700 group-hover:text-amber-800 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>ดูประวัติ ({coupon.transaction_count || 0})</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Transaction History Modal */}
      {selectedCoupon && (
        <CouponHistoryModal
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
        />
      )}
    </div>
  );
}
