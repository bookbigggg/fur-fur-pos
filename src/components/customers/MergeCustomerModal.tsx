"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  GitMerge,
  ArrowLeftRight,
  Crown,
  Ticket,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { CustomerWithPets, Pet } from "@/types/database";
import { getCustomersList, mergeCustomers, PetMergeMapping } from "@/app/actions/customers";

interface MergeCustomerModalProps {
  isOpen: boolean;
  currentCustomer: CustomerWithPets | null;
  onClose: () => void;
  onSuccess: (targetCustomerId: string, summaryText: string) => void;
}

function normalizeText(value?: string | null): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/^(คุณ|พี่|น้อง|แม่|พ่อ)\s*/i, "")
    .replace(/\s+/g, "");
}

function getCustomerScore(c: CustomerWithPets): number {
  const hasMem = c.pets.some((p) => p.active_membership && p.active_membership.status !== "หมดอายุ");
  const hasCoupon = c.pets.some((p) => p.active_coupons && p.active_coupons.length > 0);
  return (
    (hasMem ? 1000 : 0) +
    (hasCoupon ? 500 : 0) +
    (c.orderCount || 0) * 10 +
    (c.phone?.trim() ? 5 : 0) +
    c.pets.length
  );
}

function combineNotesDefault(targetNotes?: string | null, sourceNotes?: string | null): string {
  const t = (targetNotes || "").trim();
  const s = (sourceNotes || "").trim();
  if (t && s && t !== s) return `${t} | ${s}`;
  return t || s || "";
}

export default function MergeCustomerModal({
  isOpen,
  currentCustomer,
  onClose,
  onSuccess,
}: MergeCustomerModalProps) {
  const [allCustomers, setAllCustomers] = useState<CustomerWithPets[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOtherId, setSelectedOtherId] = useState<string | null>(null);
  const [keepTargetId, setKeepTargetId] = useState<string | null>(null);
  const [petMappingBySourceId, setPetMappingBySourceId] = useState<Record<string, string>>({});
  const [mergedPhone, setMergedPhone] = useState("");
  const [mergedNotes, setMergedNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentCustomer) {
      setSearch("");
      setSelectedOtherId(null);
      setKeepTargetId(null);
      setPetMappingBySourceId({});
      setMergedPhone("");
      setMergedNotes("");
      setError(null);
      return;
    }

    let cancelled = false;
    setLoadingList(true);
    setError(null);

    getCustomersList({ sort: "visits" })
      .then((res) => {
        if (!cancelled && res.success) {
          setAllCustomers(res.customers.filter((c) => c.id !== currentCustomer.id));
        }
      })
      .catch((err) => {
        console.error("Load customers for merge failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentCustomer]);

  const currentWithStats = useMemo(() => {
    if (!currentCustomer) return null;
    return currentCustomer;
  }, [currentCustomer]);

  const otherCustomer = useMemo(
    () => allCustomers.find((c) => c.id === selectedOtherId) || null,
    [allCustomers, selectedOtherId]
  );

  const { targetCustomer, sourceCustomer } = useMemo(() => {
    if (!currentWithStats || !otherCustomer) {
      return { targetCustomer: null, sourceCustomer: null };
    }
    if (keepTargetId === otherCustomer.id) {
      return { targetCustomer: otherCustomer, sourceCustomer: currentWithStats };
    }
    return { targetCustomer: currentWithStats, sourceCustomer: otherCustomer };
  }, [currentWithStats, otherCustomer, keepTargetId]);

  // เมื่อเลือกลูกค้าอีกฝั่ง ให้ตั้งค่า default ฝั่งหลักและจับคู่สัตว์เลี้ยงชื่อตรงกันอัตโนมัติ
  const initializeMergeDefaults = (custA: CustomerWithPets, custB: CustomerWithPets) => {
    const scoreA = getCustomerScore(custA);
    const scoreB = getCustomerScore(custB);
    const defaultTarget = scoreB > scoreA ? custB : custA;
    const defaultSource = defaultTarget.id === custA.id ? custB : custA;

    setKeepTargetId(defaultTarget.id);
    applyDefaultsForPair(defaultTarget, defaultSource);
  };

  const applyDefaultsForPair = (target: CustomerWithPets, source: CustomerWithPets) => {
    const autoMap: Record<string, string> = {};
    for (const sp of source.pets) {
      const spNorm = sp.name.trim().toLowerCase();
      const matchedTargetPet = target.pets.find(
        (tp) => tp.name.trim().toLowerCase() === spNorm
      );
      if (matchedTargetPet) {
        autoMap[sp.id] = matchedTargetPet.id;
      }
    }
    setPetMappingBySourceId(autoMap);
    setMergedPhone((target.phone || "").trim() || (source.phone || "").trim() || "");
    setMergedNotes(combineNotesDefault(target.notes, source.notes));
  };

  const handleSelectOther = (candidate: CustomerWithPets) => {
    if (!currentWithStats) return;
    setSelectedOtherId(candidate.id);
    setError(null);
    initializeMergeDefaults(currentWithStats, candidate);
  };

  const handleSwapSides = () => {
    if (!targetCustomer || !sourceCustomer) return;
    const nextTarget = sourceCustomer;
    const nextSource = targetCustomer;
    setKeepTargetId(nextTarget.id);
    applyDefaultsForPair(nextTarget, nextSource);
  };

  // แนะนำรายชื่อที่น่าจะซ้ำกัน (ชื่อคล้ายกัน, ชื่อสัตว์เลี้ยงเหมือนกัน, หรือเบอร์เดียวกัน)
  const suggestedMatches = useMemo(() => {
    if (!currentWithStats) return [];
    const curNameNorm = normalizeText(currentWithStats.name);
    const curPhoneDigits = (currentWithStats.phone || "").replace(/[^0-9]/g, "");
    const curPetNames = new Set(currentWithStats.pets.map((p) => p.name.trim().toLowerCase()));

    return allCustomers.filter((c) => {
      const candNameNorm = normalizeText(c.name);
      const nameSimilar =
        curNameNorm.length >= 2 &&
        candNameNorm.length >= 2 &&
        (candNameNorm.includes(curNameNorm) || curNameNorm.includes(candNameNorm));

      const candPhoneDigits = (c.phone || "").replace(/[^0-9]/g, "");
      const phoneMatch =
        curPhoneDigits.length >= 6 && candPhoneDigits.length >= 6 && curPhoneDigits === candPhoneDigits;

      const petMatch = c.pets.some((p) => curPetNames.has(p.name.trim().toLowerCase()));

      return nameSimilar || phoneMatch || petMatch;
    });
  }, [allCustomers, currentWithStats]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    if (!q) {
      return allCustomers.slice(0, 30);
    }
    return allCustomers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch =
        qDigits.length >= 2 && (c.phone || "").replace(/[^0-9]/g, "").includes(qDigits);
      const petMatch = c.pets.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.pet_code || "").toLowerCase().includes(q) ||
          (p.breed || "").toLowerCase().includes(q)
      );
      return nameMatch || phoneMatch || petMatch;
    });
  }, [allCustomers, search]);

  if (!isOpen || !currentCustomer) return null;

  const handleConfirmMerge = async () => {
    if (!targetCustomer || !sourceCustomer) return;
    setIsSubmitting(true);
    setError(null);

    const petMappings: PetMergeMapping[] = Object.entries(petMappingBySourceId)
      .filter(([, targetPetId]) => Boolean(targetPetId))
      .map(([sourcePetId, targetPetId]) => ({ sourcePetId, targetPetId }));

    try {
      const res = await mergeCustomers({
        sourceCustomerId: sourceCustomer.id,
        targetCustomerId: targetCustomer.id,
        petMappings,
        mergedPhone: mergedPhone.trim() || null,
        mergedNotes: mergedNotes.trim() || null,
      });

      if (!res.success) {
        setError(res.error || "ไม่สามารถรวมลูกค้าได้");
        setIsSubmitting(false);
        return;
      }

      const summary = `รวม "${sourceCustomer.name}" เข้ากับ "${targetCustomer.name}" สำเร็จ (ย้าย ${res.movedOrdersCount || 0} บิล, สัตว์เลี้ยง ${
        (res.movedPetsCount || 0) + (res.mergedPetsCount || 0)
      } ตัว)`;
      onSuccess(targetCustomer.id, summary);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรวมลูกค้า");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPetBadges = (pets: Pet[]) => {
    const hasMem = pets.some((p) => p.active_membership && p.active_membership.status !== "หมดอายุ");
    const couponBal = pets.reduce(
      (sum, p) =>
        sum + (p.active_coupons || []).reduce((s, cp) => s + Number(cp.remaining_balance || 0), 0),
      0
    );
    return (
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {hasMem && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
            <Crown className="w-2.5 h-2.5" />
            สมาชิก 299
          </span>
        )}
        {couponBal > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
            <Ticket className="w-2.5 h-2.5" />
            ฿{couponBal.toLocaleString()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <GitMerge className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">รวมลูกค้าซ้ำเข้าด้วยกัน</h2>
              <p className="text-[11px] text-stone-400 truncate">
                ตั้งต้นจาก: {currentCustomer.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!otherCustomer ? (
            /* Step 1: Select the duplicate customer */
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือชื่อน้องที่ซ้ำกัน..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {loadingList ? (
                <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs">กำลังโหลดรายชื่อลูกค้า...</span>
                </div>
              ) : (
                <>
                  {!search.trim() && suggestedMatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>รายชื่อที่อาจซ้ำกับ &ldquo;{currentCustomer.name}&rdquo;</span>
                      </p>
                      <div className="space-y-1.5">
                        {suggestedMatches.map((cand) => (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => handleSelectOther(cand)}
                            className="w-full text-left p-3 rounded-2xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-stone-900">{cand.name}</span>
                                <span className="text-[11px] font-mono text-stone-600">
                                  {cand.phone || "ไม่มีเบอร์"}
                                </span>
                              </div>
                              <p className="text-xs text-stone-600 truncate mt-0.5">
                                น้อง: {cand.pets.map((p) => p.name).join(", ") || "-"}
                              </p>
                              {renderPetBadges(cand.pets)}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-xs font-bold text-stone-700">
                                {cand.orderCount || 0} บิล
                              </span>
                              <p className="text-[10px] text-amber-700 font-bold mt-1">เลือก ❯</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-stone-500">
                      {search.trim()
                        ? `ผลการค้นหา (${filteredCandidates.length})`
                        : "รายชื่อลูกค้าทั้งหมดในระบบ"}
                    </p>
                    {filteredCandidates.length === 0 ? (
                      <div className="py-10 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        ไม่พบรายชื่อลูกค้าที่ค้นหา
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {filteredCandidates.map((cand) => (
                          <button
                            key={cand.id}
                            type="button"
                            onClick={() => handleSelectOther(cand)}
                            className="w-full text-left p-3 rounded-2xl border border-stone-200 hover:border-amber-400 bg-white hover:bg-stone-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-stone-900">{cand.name}</span>
                                <span className="text-[11px] font-mono text-stone-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {cand.phone || "ไม่มีเบอร์"}
                                </span>
                              </div>
                              <p className="text-xs text-stone-500 truncate mt-0.5">
                                น้อง: {cand.pets.map((p) => p.name).join(", ") || "ยังไม่มีสัตว์เลี้ยง"}
                              </p>
                              {renderPetBadges(cand.pets)}
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-xs font-bold text-stone-600 shrink-0">
                              {cand.orderCount || 0} บิล
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Step 2: Review & Configure Merge */
            targetCustomer &&
            sourceCustomer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOtherId(null)}
                    className="text-xs font-bold text-stone-600 hover:text-stone-900 underline cursor-pointer"
                  >
                    ‹ เปลี่ยนรายชื่อลูกค้าที่เลือก
                  </button>
                  <button
                    type="button"
                    onClick={handleSwapSides}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>สลับฝั่งหลัก ↔ รอง</span>
                  </button>
                </div>

                {/* Comparison Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Source (Will be removed) */}
                  <div className="p-3.5 rounded-2xl border-2 border-rose-200 bg-rose-50/50 space-y-1.5">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                      ฝั่งรอง • จะถูกยุบรวมและลบทิ้ง
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">{sourceCustomer.name}</h4>
                    <p className="text-xs text-stone-600 font-mono">
                      {sourceCustomer.phone || "ไม่มีเบอร์โทรศัพท์"}
                    </p>
                    <p className="text-xs text-stone-600">
                      {sourceCustomer.pets.length} สัตว์เลี้ยง • {sourceCustomer.orderCount || 0} บิล
                    </p>
                    {renderPetBadges(sourceCustomer.pets)}
                  </div>

                  {/* Target (Will be kept) */}
                  <div className="p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 space-y-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      <CheckCircle2 className="w-3 h-3" />
                      ลูกค้าหลัก • เก็บไว้ในระบบ
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">{targetCustomer.name}</h4>
                    <p className="text-xs text-stone-600 font-mono">
                      {targetCustomer.phone || "ไม่มีเบอร์โทรศัพท์"}
                    </p>
                    <p className="text-xs text-stone-600">
                      {targetCustomer.pets.length} สัตว์เลี้ยง • {targetCustomer.orderCount || 0} บิล
                    </p>
                    {renderPetBadges(targetCustomer.pets)}
                  </div>
                </div>

                {/* Pet Mapping Section */}
                {sourceCustomer.pets.length > 0 && (
                  <div className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2.5">
                    <p className="text-xs font-bold text-stone-800">
                      จัดการสัตว์เลี้ยงจากฝั่ง &ldquo;{sourceCustomer.name}&rdquo; ({sourceCustomer.pets.length} ตัว)
                    </p>
                    <div className="space-y-2">
                      {sourceCustomer.pets.map((sp) => {
                        const selectedTargetPetId = petMappingBySourceId[sp.id] || "";
                        const exactMatch = targetCustomer.pets.some(
                          (tp) => tp.name.trim().toLowerCase() === sp.name.trim().toLowerCase()
                        );

                        return (
                          <div
                            key={sp.id}
                            className="p-2.5 rounded-xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="text-xs min-w-0">
                              <span className="font-bold text-stone-900">
                                {sp.species === "แมว" ? "🐱" : "🐶"} {sp.name}
                              </span>
                              {sp.pet_code && (
                                <span className="ml-1.5 font-mono text-[10px] text-stone-500">
                                  ({sp.pet_code})
                                </span>
                              )}
                              {exactMatch && (
                                <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  ชื่อตรงกัน
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <ArrowRight className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
                              <select
                                value={selectedTargetPetId}
                                onChange={(e) =>
                                  setPetMappingBySourceId((prev) => ({
                                    ...prev,
                                    [sp.id]: e.target.value,
                                  }))
                                }
                                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-base md:text-xs font-semibold text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                              >
                                <option value="">ย้ายเข้าเป็นอีกตัวในบ้านหลัก</option>
                                {targetCustomer.pets.map((tp) => (
                                  <option key={tp.id} value={tp.id}>
                                    รวมประวัติกับน้อง {tp.name} {tp.pet_code ? `(${tp.pet_code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Merged Phone & Notes Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      เบอร์โทรหลังรวม (เก็บที่ลูกค้าหลัก)
                    </label>
                    <input
                      type="tel"
                      value={mergedPhone}
                      onChange={(e) => setMergedPhone(e.target.value)}
                      placeholder="เช่น 0891234567"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 text-base md:text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      หมายเหตุหลังรวม
                    </label>
                    <input
                      type="text"
                      value={mergedNotes}
                      onChange={(e) => setMergedNotes(e.target.value)}
                      placeholder="หมายเหตุรวม (ถ้ามี)"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 text-base md:text-sm"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    ประวัติบิลทั้งหมด <strong>{sourceCustomer.orderCount || 0} บิล</strong>, สัตว์เลี้ยง, สมาชิกรายปี และคูปองของ{" "}
                    <strong>&ldquo;{sourceCustomer.name}&rdquo;</strong> จะถูกย้ายไปอยู่ภายใต้{" "}
                    <strong>&ldquo;{targetCustomer.name}&rdquo;</strong> และไม่สามารถย้อนกลับอัตโนมัติได้
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-bold hover:bg-stone-100 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          {otherCustomer && targetCustomer && sourceCustomer && (
            <button
              type="button"
              onClick={handleConfirmMerge}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังรวมข้อมูล...</span>
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4" />
                  <span>
                    ยืนยันรวมเข้า &ldquo;{targetCustomer.name}&rdquo;
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
