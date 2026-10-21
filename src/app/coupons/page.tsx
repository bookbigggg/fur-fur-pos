"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  Ticket, 
  Crown,
  Search, 
  PlusCircle, 
  Calendar, 
  Phone, 
  Copy, 
  Check, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RotateCw
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { getCouponsSummary, getMembershipsSummary } from "@/app/actions/coupons";
import { 
  CouponWithDetails, 
  CouponSummaryKPI, 
  MembershipWithDetails, 
  MembershipSummaryKPI 
} from "@/types/database";
import CouponHistoryModal from "@/components/coupons/CouponHistoryModal";
import { copyToClipboard } from "@/lib/clipboard";

type MainTab = "coupon" | "membership";
type CouponStatusFilter = "all" | "active" | "exhausted";
type MembershipStatusFilter = "all" | "active" | "expiring" | "expired";

export default function PackagesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("coupon");

  // State: คูปองเงินสด
  const [coupons, setCoupons] = useState<CouponWithDetails[]>([]);
  const [couponKpi, setCouponKpi] = useState<CouponSummaryKPI>({
    totalCoupons: 0,
    activeCount: 0,
    exhaustedCount: 0,
    totalRemainingCredit: 0,
    totalPaidAmount: 0,
    totalPackageValue: 0,
    totalLiability: 0,
    totalUsedCredit: 0,
  });

  // State: สมาชิกรายปี 299
  const [memberships, setMemberships] = useState<MembershipWithDetails[]>([]);
  const [membershipKpi, setMembershipKpi] = useState<MembershipSummaryKPI>({
    totalMemberships: 0,
    activeCount: 0,
    expiringCount: 0,
    expiredCount: 0,
    totalIncome: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [couponFilter, setCouponFilter] = useState<CouponStatusFilter>("all");
  const [membershipFilter, setMembershipFilter] = useState<MembershipStatusFilter>("all");
  const [selectedCoupon, setSelectedCoupon] = useState<CouponWithDetails | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [cpnRes, memRes] = await Promise.all([
        getCouponsSummary(),
        getMembershipsSummary(),
      ]);

      if (cpnRes.success) {
        setCoupons(cpnRes.coupons);
        setCouponKpi(cpnRes.kpi);
      }

      if (memRes.success) {
        setMemberships(memRes.memberships);
        setMembershipKpi(memRes.kpi);
      }
    } catch (err) {
      console.error("Failed to load packages data:", err);
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

  // กรองคูปองเงินสด
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (couponFilter === "active") {
        if (c.status !== "ใช้งานได้" || Number(c.remaining_balance) <= 0) return false;
      } else if (couponFilter === "exhausted") {
        if (c.status === "ใช้งานได้" && Number(c.remaining_balance) > 0) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const codeMatch = c.coupon_code?.toLowerCase().includes(q);
      const petNameMatch = c.pet?.name?.toLowerCase().includes(q);
      const custNameMatch = c.pet?.customer?.name?.toLowerCase().includes(q);
      const phoneMatch = c.pet?.customer?.phone?.replace(/-/g, "").includes(q.replace(/-/g, ""));
      const breedMatch = c.pet?.breed?.toLowerCase().includes(q);

      return codeMatch || petNameMatch || custNameMatch || phoneMatch || breedMatch;
    });
  }, [coupons, couponFilter, searchQuery]);

  // กรองสมาชิกรายปี
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      if (membershipFilter === "active" && m.computed_status !== "ใช้งานได้") return false;
      if (membershipFilter === "expiring" && m.computed_status !== "ใกล้หมดอายุ") return false;
      if (membershipFilter === "expired" && m.computed_status !== "หมดอายุ") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const codeMatch = m.member_code?.toLowerCase().includes(q);
      const petNameMatch = m.pet?.name?.toLowerCase().includes(q);
      const custNameMatch = m.pet?.customer?.name?.toLowerCase().includes(q);
      const phoneMatch = m.pet?.customer?.phone?.replace(/-/g, "").includes(q.replace(/-/g, ""));
      const breedMatch = m.pet?.breed?.toLowerCase().includes(q);

      return codeMatch || petNameMatch || custNameMatch || phoneMatch || breedMatch;
    });
  }, [memberships, membershipFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans pb-16">
      <Navbar 
        subtitle="แพ็กเกจ & สมาชิก" 
        onRefresh={() => loadData(true)} 
        isRefreshing={refreshing} 
      />

      <main className="max-w-xl mx-auto w-full px-4 pt-3 space-y-3.5 flex-1">
        {/* Main Tabs: สลับระหว่าง คูปองเงินสด และ สมาชิกรายปี 299 */}
        <section className="bg-stone-200/80 p-1.5 rounded-2xl flex gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveTab("coupon");
              setSearchQuery("");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "coupon"
                ? "bg-white text-amber-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Ticket className={`w-4 h-4 ${activeTab === "coupon" ? "text-amber-600" : "text-stone-400"}`} />
            <span>คูปองเงินสด</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === "coupon" ? "bg-amber-100 text-amber-800" : "bg-stone-300/70 text-stone-600"
            }`}>
              {couponKpi.activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("membership");
              setSearchQuery("");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "membership"
                ? "bg-white text-emerald-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Crown className={`w-4 h-4 ${activeTab === "membership" ? "text-emerald-600" : "text-stone-400"}`} />
            <span>สมาชิกรายปี 299</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === "membership" ? "bg-emerald-100 text-emerald-800" : "bg-stone-300/70 text-stone-600"
            }`}>
              {membershipKpi.activeCount}
            </span>
          </button>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: คูปองเงินสด                                            */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "coupon" && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Quick Link Banner */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block">
                  TFRS 15 Cash Package
                </span>
                <h2 className="text-sm font-black mt-1 leading-tight truncate">
                  ระบบบริหารคูปองเงินสด
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

            {/* KPI Cards: คูปอง */}
            <section className="grid grid-cols-2 gap-2.5">
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
                  ฿{couponKpi.totalRemainingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-stone-400">
                  จากมูลค่าเต็ม ฿{couponKpi.totalPackageValue.toLocaleString()}
                </p>
              </div>

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
                  ฿{couponKpi.totalLiability.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-purple-600/80">
                  ภาระส่งมอบบริการจริง
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-stone-500 block">
                  สถานะคูปองทั้งหมด
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-emerald-700">
                    {couponKpi.activeCount}
                  </span>
                  <span className="text-xs font-bold text-stone-400">
                    / {couponKpi.totalCoupons} ใบ
                  </span>
                </div>
                <p className="text-[10px] text-stone-400">
                  ใช้หมดแล้ว {couponKpi.exhaustedCount} ใบ
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-stone-500 block">
                  เงินสดรับเปิดคูปองสะสม
                </span>
                <p className="text-lg font-black text-stone-800 tracking-tight">
                  ฿{couponKpi.totalPaidAmount.toLocaleString()}
                </p>
                <p className="text-[10px] text-stone-400">
                  ใช้บริการตัดแล้ว ฿{couponKpi.totalUsedCredit.toLocaleString()}
                </p>
              </div>
            </section>

            {/* Filter & Search Bar: คูปอง */}
            <section className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-3">
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

              <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCouponFilter("all")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    couponFilter === "all"
                      ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ทั้งหมด ({coupons.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCouponFilter("active")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    couponFilter === "active"
                      ? "bg-white text-emerald-800 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ใช้งานได้ ({couponKpi.activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCouponFilter("exhausted")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    couponFilter === "exhausted"
                      ? "bg-white text-stone-800 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ใช้หมดแล้ว ({couponKpi.exhaustedCount})
                </button>
              </div>
            </section>

            {/* List: คูปอง */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-amber-600" />
                  <span>รายการคูปอง ({filteredCoupons.length})</span>
                </h3>
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
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: สมาชิกรายปี 299 (Annual Membership)                   */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "membership" && (
          <div className="space-y-3.5 animate-in fade-in duration-200">
            {/* Quick Link Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block">
                  Annual Membership 299.-/ปี
                </span>
                <h2 className="text-sm font-black mt-1 leading-tight truncate">
                  ระบบสมาชิกรายปี & ส่วนลด 10%
                </h2>
                <p className="text-[11px] text-emerald-100/90 mt-0.5">
                  เช็กวันหมดอายุ ระบบ Smart Early Renewal บวกทบ 365 วัน
                </p>
              </div>
              <Link
                href="/pos"
                className="shrink-0 bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span>สมัคร/ต่ออายุ</span>
              </Link>
            </div>

            {/* KPI Cards: สมาชิก */}
            <section className="grid grid-cols-2 gap-2.5">
              <div className="bg-white rounded-2xl p-3.5 border border-emerald-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    สมาชิกใช้งานได้
                  </span>
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xl font-black text-emerald-900 tracking-tight">
                  {membershipKpi.activeCount} <span className="text-xs font-bold text-stone-400">/ {membershipKpi.totalMemberships} ตัว</span>
                </p>
                <p className="text-[10px] text-stone-400">
                  สิทธิ์ลดค่าบริการ Grooming 10%
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-amber-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    ใกล้หมดอายุ
                  </span>
                  <span className="text-[9px] font-bold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                    ≤ 30 วัน
                  </span>
                </div>
                <p className="text-xl font-black text-amber-800 tracking-tight">
                  {membershipKpi.expiringCount} <span className="text-xs font-bold text-stone-400">ตัว</span>
                </p>
                <p className="text-[10px] text-amber-700">
                  เตรียมทักแจ้งต่ออายุล่วงหน้า
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-rose-200/90 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    สมาชิกหมดอายุแล้ว
                  </span>
                  <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                    Expired
                  </span>
                </div>
                <p className="text-xl font-black text-rose-800 tracking-tight">
                  {membershipKpi.expiredCount} <span className="text-xs font-bold text-stone-400">ตัว</span>
                </p>
                <p className="text-[10px] text-stone-400">
                  หมดอายุตามรอบ 365 วัน
                </p>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-stone-500 block">
                  รายได้ค่าสมาชิกสะสม
                </span>
                <p className="text-lg font-black text-stone-800 tracking-tight">
                  ฿{membershipKpi.totalIncome.toLocaleString()}
                </p>
                <p className="text-[10px] text-stone-400">
                  ค่าธรรมเนียม ฿299 / ตัว / ปี
                </p>
              </div>
            </section>

            {/* Filter & Search Bar: สมาชิก */}
            <section className="bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ชื่อน้อง, รหัส MEM-..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-base md:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
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

              <div className="grid grid-cols-4 gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMembershipFilter("all")}
                  className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    membershipFilter === "all"
                      ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ทั้งหมด ({memberships.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMembershipFilter("active")}
                  className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    membershipFilter === "active"
                      ? "bg-white text-emerald-800 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ใช้งานได้ ({membershipKpi.activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMembershipFilter("expiring")}
                  className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    membershipFilter === "expiring"
                      ? "bg-white text-amber-900 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ใกล้หมด ({membershipKpi.expiringCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMembershipFilter("expired")}
                  className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    membershipFilter === "expired"
                      ? "bg-white text-rose-800 shadow-2xs font-extrabold"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  หมดอายุ ({membershipKpi.expiredCount})
                </button>
              </div>
            </section>

            {/* List: สมาชิก */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-emerald-600" />
                  <span>รายชื่อสมาชิก ({filteredMemberships.length})</span>
                </h3>
              </div>

              {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center space-y-2 border border-stone-200/90 shadow-2xs">
                  <div className="inline-block w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-stone-400 font-medium">กำลังโหลดข้อมูลสมาชิก...</p>
                </div>
              ) : filteredMemberships.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center space-y-3 border border-stone-200/90 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Crown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-800">ไม่พบสมาชิกที่ตรงตามเงื่อนไข</p>
                    <p className="text-xs text-stone-400 mt-0.5">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรองสถานะ</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMemberships.map((mem) => {
                    const startDate = new Date(mem.start_date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                    const expireDate = new Date(mem.expire_date).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    const isExpiring = mem.computed_status === "ใกล้หมดอายุ";
                    const isExpired = mem.computed_status === "หมดอายุ";
                    const isActive = mem.computed_status === "ใช้งานได้";

                    return (
                      <div
                        key={mem.id}
                        className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all space-y-3"
                      >
                        {/* Header: Pet Name & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center font-bold text-base border border-emerald-200/60 shrink-0">
                              {mem.pet?.species === "แมว" ? "🐱" : "🐶"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-stone-900 text-sm">
                                  น้อง{mem.pet?.name || "ไม่ระบุชื่อ"}
                                </span>
                                <span className="text-[10px] font-black bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full border border-stone-200">
                                  {mem.member_code || "MEM"}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {mem.pet?.species || "สัตว์เลี้ยง"}
                                {mem.pet?.breed && ` • ${mem.pet.breed}`}
                                {mem.pet?.weight_kg && ` (${mem.pet.weight_kg} kg)`}
                              </p>
                            </div>
                          </div>

                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                            isActive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isExpiring
                              ? "bg-amber-50 text-amber-900 border-amber-300"
                              : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}>
                            {isActive && <ShieldCheck className="w-3 h-3 text-emerald-600" />}
                            {isExpiring && <Clock className="w-3 h-3 text-amber-700" />}
                            {isExpired && <AlertCircle className="w-3 h-3 text-rose-600" />}
                            <span>{mem.computed_status}</span>
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-stone-50/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-stone-600 border border-stone-100">
                          <span className="truncate font-medium">
                            เจ้าของ: <span className="font-bold text-stone-800">{mem.pet?.customer?.name || "ลูกค้าทั่วไป"}</span>
                          </span>

                          {mem.pet?.customer?.phone && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`tel:${mem.pet.customer.phone}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/70"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{mem.pet.customer.phone}</span>
                              </a>

                              <button
                                type="button"
                                onClick={(e) => handleCopyPhone(mem.pet!.customer!.phone!, e)}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
                                title="คัดลอกเบอร์โทร"
                              >
                                {copiedPhone === mem.pet.customer.phone ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Validity Period & Countdown */}
                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-stone-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              <span>ระยะเวลาสมาชิก:</span>
                            </span>
                            <span className="font-bold text-stone-800">
                              {startDate} – {expireDate}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100/70">
                            <span className="text-[11px] text-stone-500">คงเหลือเวลา:</span>
                            <span className={`font-extrabold ${
                              isExpired
                                ? "text-rose-600"
                                : isExpiring
                                ? "text-amber-800"
                                : "text-emerald-800"
                            }`}>
                              {isExpired
                                ? `หมดอายุไปแล้ว ${Math.abs(mem.days_remaining)} วัน`
                                : `เหลืออีก ${mem.days_remaining} วัน`}
                            </span>
                          </div>
                        </div>

                        {/* Footer: Fee & Smart Renewal Action */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
                          <span className="text-stone-400">
                            ค่าบริการ ฿{(Number(mem.fee) || 299).toLocaleString()} / ปี • ลด 10%
                          </span>

                          <Link
                            href="/pos"
                            className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 hover:underline"
                          >
                            <RotateCw className="w-3 h-3 text-emerald-600" />
                            <span>ต่ออายุล่วงหน้า (+365 วัน)</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
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
