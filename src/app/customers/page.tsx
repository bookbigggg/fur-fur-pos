"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  Users, 
  Search, 
  Plus, 
  Dog, 
  Cat, 
  Sparkles, 
  Crown, 
  Ticket, 
  Phone, 
  Copy, 
  Check, 
  ChevronRight, 
  AlertTriangle, 
  ShoppingBag, 
  ArrowUpDown, 
  Calendar,
  X,
  Loader2
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { CustomerWithPets, CustomerStatsKPI, Pet } from "@/types/database";
import { getCustomersList, getCustomerStats } from "@/app/actions/customers";
import { copyToClipboard } from "@/lib/clipboard";
import CustomerFormModal from "@/components/customers/CustomerFormModal";
import PetFormModal from "@/components/customers/PetFormModal";
import CustomerDetailModal from "@/components/customers/CustomerDetailModal";

type FilterType = "all" | "membership" | "coupon" | "dog" | "cat";
type SortType = "name" | "latest" | "pets_count";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithPets[]>([]);
  const [stats, setStats] = useState<CustomerStatsKPI>({
    totalCustomers: 0,
    totalPets: 0,
    activeMembershipsCount: 0,
    activeCouponsCount: 0,
    totalCouponBalance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("name");

  // Modals state
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerWithPets | null>(null);
  const [isPetFormOpen, setIsPetFormOpen] = useState(false);
  const [petToEdit, setPetToEdit] = useState<Pet | null>(null);
  const [targetCustomerForPet, setTargetCustomerForPet] = useState<CustomerWithPets | null>(null);

  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [listRes, statsRes] = await Promise.all([
        getCustomersList({ search: searchQuery, filter, sort }),
        getCustomerStats(),
      ]);

      if (listRes.success) {
        setCustomers(listRes.customers);
      }
      setStats(statsRes);
    } catch (err) {
      console.error("Load customers error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filter, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyPhone = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(phone);
    if (ok) {
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    }
  };

  const handleOpenCreateCustomer = () => {
    setCustomerToEdit(null);
    setIsCustomerFormOpen(true);
  };

  const handleOpenEditCustomer = (customer: CustomerWithPets) => {
    setCustomerToEdit(customer);
    setIsCustomerFormOpen(true);
  };

  const handleOpenAddPet = (customer: CustomerWithPets) => {
    setTargetCustomerForPet(customer);
    setPetToEdit(null);
    setIsPetFormOpen(true);
  };

  const handleOpenEditPet = (pet: Pet, customer: CustomerWithPets) => {
    setTargetCustomerForPet(customer);
    setPetToEdit(pet);
    setIsPetFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      <Navbar
        subtitle="ฐานข้อมูลลูกค้า สัตว์เลี้ยง ประวัติบริการ และสมาชิก"
        onRefresh={() => loadData(true)}
        isRefreshing={refreshing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: ลูกค้าทั้งหมด */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">ลูกค้าทั้งหมด</p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-0.5">
                {stats.totalCustomers.toLocaleString()} <span className="text-xs font-normal text-stone-500">ราย</span>
              </p>
            </div>
          </div>

          {/* Card 2: สัตว์เลี้ยงทั้งหมด */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <Dog className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">สัตว์เลี้ยงทั้งหมด</p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-0.5">
                {stats.totalPets.toLocaleString()} <span className="text-xs font-normal text-stone-500">ตัว</span>
              </p>
            </div>
          </div>

          {/* Card 3: สมาชิกรายปี */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">สมาชิกรายปี 299</p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-0.5">
                {stats.activeMembershipsCount.toLocaleString()} <span className="text-xs font-normal text-stone-500">ตัว</span>
              </p>
            </div>
          </div>

          {/* Card 4: คูปองเงินสดคงเหลือ */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">คูปองเงินสดคงเหลือ</p>
              <p className="text-xl sm:text-2xl font-black text-stone-900 font-mono mt-0.5">
                ฿{stats.totalCouponBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar: Search, Filters & Add Button */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input (anti-zoom text-base md:text-sm) */}
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ชื่อน้อง, สายพันธุ์, หรือ PET-0001..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-stone-50/50 hover:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Dropdown & Add Button */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative inline-flex items-center">
                <ArrowUpDown className="w-3.5 h-3.5 absolute left-3 pointer-events-none text-stone-500" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortType)}
                  className="pl-8 pr-7 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 cursor-pointer appearance-none"
                >
                  <option value="name">เรียงตามชื่อ ก-ฮ</option>
                  <option value="latest">มาใช้บริการล่าสุด</option>
                  <option value="pets_count">สัตว์เลี้ยงมากสุด</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateCustomer}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มลูกค้าใหม่</span>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                filter === "all"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              ทั้งหมด ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("membership")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filter === "membership"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>มีสมาชิกรายปี</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("coupon")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filter === "coupon"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>มีคูปองคงเหลือ</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("dog")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filter === "dog"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Dog className="w-3.5 h-3.5" />
              <span>น้องหมา</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("cat")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                filter === "cat"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <Cat className="w-3.5 h-3.5" />
              <span>น้องแมว</span>
            </button>
          </div>
        </div>

        {/* Customer Cards Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-stone-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs font-medium">กำลังโหลดฐานข้อมูลลูกค้า...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-stone-300 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-700">ไม่พบรายชื่อลูกค้าที่ตรงกับเงื่อนไข</p>
              <p className="text-xs text-stone-500 mt-0.5">ลองค้นหาด้วยคำอื่น หรือกดเพิ่มลูกค้าใหม่</p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateCustomer}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มลูกค้าใหม่ทันที</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((c) => {
              const hasNotes = Boolean(c.notes && c.notes.trim());

              return (
                <div
                  key={c.id}
                  onClick={() => setDetailCustomerId(c.id)}
                  className="bg-white rounded-2xl border border-stone-200/90 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all p-4 flex flex-col justify-between cursor-pointer group space-y-3"
                >
                  {/* Customer Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-stone-900 group-hover:text-amber-600 transition-colors truncate">
                          {c.name}
                        </h3>
                        {c.phone ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-mono font-medium text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{c.phone}</span>
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPhone(c.phone!, e)}
                              className="p-0.5 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                              title="คัดลอกเบอร์โทร"
                            >
                              {copiedPhone === c.phone ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-stone-400 mt-0.5">ไม่มีเบอร์โทรศัพท์</p>
                        )}
                      </div>

                      {/* Order Count / Last visit badge */}
                      <div className="text-right shrink-0">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-[10px] font-bold text-stone-600 border border-stone-200">
                          {c.orderCount || 0} บิล
                        </span>
                        {c.lastOrderDate && (
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            ล่าสุด {c.lastOrderDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Customer Notes */}
                    {hasNotes && (
                      <div className="mt-2.5 p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 line-clamp-2">
                        <span className="font-bold text-amber-800">หมายเหตุ: </span>
                        {c.notes}
                      </div>
                    )}
                  </div>

                  {/* Pets List in Customer */}
                  <div className="pt-2 border-t border-stone-100 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      <span>สัตว์เลี้ยง ({c.pets.length})</span>
                      <span className="text-[10px] text-amber-600 font-semibold group-hover:underline">
                        ดูรายละเอียด ❯
                      </span>
                    </div>

                    {c.pets.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">ยังไม่มีสัตว์เลี้ยง</p>
                    ) : (
                      <div className="space-y-1.5">
                        {c.pets.map((p) => {
                          const isDog = p.species === "หมา";
                          const isCat = p.species === "แมว";
                          const membership = p.active_membership;
                          const hasActiveMem = membership && membership.status !== "หมดอายุ";
                          const coupons = p.active_coupons || [];
                          const couponBal = coupons.reduce((sum, cp) => sum + Number(cp.remaining_balance || 0), 0);

                          return (
                            <div
                              key={p.id}
                              className="p-2 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">
                                  {isDog ? "🐶" : isCat ? "🐱" : "🐾"}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-stone-900 truncate">{p.name}</span>
                                    {p.pet_code && (
                                      <span className="font-mono text-[10px] text-stone-500 font-semibold">
                                        ({p.pet_code})
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-stone-500 truncate">
                                    {p.breed || p.species} {p.weight_kg ? `• ${p.weight_kg} กก.` : ""}
                                  </p>
                                </div>
                              </div>

                              {/* Badges / POS Button */}
                              <div className="flex items-center gap-1 shrink-0">
                                {hasActiveMem && (
                                  <span className="p-1 rounded-md bg-amber-100 text-amber-800" title={`สมาชิกรายปี หมดอายุ ${membership.expire_date}`}>
                                    <Crown className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                {couponBal > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold" title={`คูปองคงเหลือ ฿${couponBal.toLocaleString()}`}>
                                    ฿{couponBal.toLocaleString()}
                                  </span>
                                )}
                                <Link
                                  href={`/pos?petId=${p.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors"
                                  title="เปิดบิลคิดเงิน POS ให้น้องตัวนี้"
                                >
                                  <ShoppingBag className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <CustomerDetailModal
        isOpen={Boolean(detailCustomerId)}
        customerId={detailCustomerId}
        onClose={() => setDetailCustomerId(null)}
        onRefreshParent={() => loadData(true)}
        onEditCustomer={(cust) => handleOpenEditCustomer(cust)}
        onAddPet={(cust) => handleOpenAddPet(cust)}
        onEditPet={(pet, cust) => handleOpenEditPet(pet, cust)}
      />

      <CustomerFormModal
        isOpen={isCustomerFormOpen}
        onClose={() => setIsCustomerFormOpen(false)}
        onSuccess={(cId) => {
          loadData(true);
          if (cId) setDetailCustomerId(cId);
        }}
        initialCustomer={customerToEdit}
      />

      <PetFormModal
        isOpen={isPetFormOpen}
        onClose={() => setIsPetFormOpen(false)}
        onSuccess={() => {
          loadData(true);
        }}
        customerId={targetCustomerForPet?.id || ""}
        customerName={targetCustomerForPet?.name}
        initialPet={petToEdit}
      />
    </div>
  );
}
