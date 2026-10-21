"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  X, 
  User, 
  Phone, 
  Copy, 
  Check, 
  Calendar, 
  Dog, 
  Cat, 
  Sparkles, 
  Crown, 
  Ticket, 
  AlertTriangle, 
  Clock, 
  ShoppingBag, 
  Edit3, 
  Trash2, 
  Plus, 
  Loader2, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { CustomerWithPets, Pet, Species } from "@/types/database";
import { getCustomerDetail, deletePet, deleteCustomer, CustomerOrderHistory } from "@/app/actions/customers";
import { copyToClipboard } from "@/lib/clipboard";

interface CustomerDetailModalProps {
  isOpen: boolean;
  customerId: string | null;
  onClose: () => void;
  onRefreshParent: () => void;
  onEditCustomer: (customer: CustomerWithPets) => void;
  onAddPet: (customer: CustomerWithPets) => void;
  onEditPet: (pet: Pet, customer: CustomerWithPets) => void;
}

export default function CustomerDetailModal({
  isOpen,
  customerId,
  onClose,
  onRefreshParent,
  onEditCustomer,
  onAddPet,
  onEditPet,
}: CustomerDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerWithPets | null>(null);
  const [orders, setOrders] = useState<CustomerOrderHistory[]>([]);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [activeTab, setActiveTab] = useState<"pets" | "history">("pets");
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await getCustomerDetail(customerId);
      if (res.success && res.customer) {
        setCustomer(res.customer);
        setOrders(res.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      loadData();
      setActiveTab("pets");
    } else {
      setCustomer(null);
      setOrders([]);
    }
  }, [isOpen, customerId, loadData]);

  if (!isOpen) return null;

  const handleCopyPhone = async (phone: string) => {
    const ok = await copyToClipboard(phone);
    if (ok) {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleDeletePet = async (pet: Pet) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลสัตว์เลี้ยง "${pet.name}"?`)) {
      return;
    }
    setDeletingPetId(pet.id);
    setActionError(null);
    try {
      const res = await deletePet(pet.id);
      if (!res.success) {
        setActionError(res.error || "ไม่สามารถลบสัตว์เลี้ยงได้");
      } else {
        loadData();
        onRefreshParent();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setDeletingPetId(null);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้า "${customer.name}" และสัตว์เลี้ยงทั้งหมด?`)) {
      return;
    }
    setIsDeletingCustomer(true);
    setActionError(null);
    try {
      const res = await deleteCustomer(customer.id);
      if (!res.success) {
        setActionError(res.error || "ไม่สามารถลบข้อมูลลูกค้าได้");
        setIsDeletingCustomer(false);
      } else {
        onRefreshParent();
        onClose();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setIsDeletingCustomer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                {customer?.name || "รายละเอียดลูกค้า"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <span>{customer?.pets?.length || 0} สัตว์เลี้ยง</span>
                <span>•</span>
                <span>{orders.length} ประวัติบิล</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{actionError}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs">กำลังโหลดข้อมูลลูกค้า...</p>
            </div>
          ) : !customer ? (
            <div className="py-20 text-center text-stone-500 text-sm">
              ไม่พบข้อมูลลูกค้า
            </div>
          ) : (
            <>
              {/* Customer Profile Card */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900">{customer.name}</h3>
                    {customer.phone ? (
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={`tel:${customer.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-700 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{customer.phone}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(customer.phone!)}
                          className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
                          title="คัดลอกเบอร์โทร"
                        >
                          {copiedPhone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 mt-1">ไม่มีเบอร์โทรศัพท์</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditCustomer(customer)}
                      className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCustomer}
                      disabled={isDeletingCustomer}
                      className="p-1.5 rounded-xl bg-white border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-colors cursor-pointer shadow-2xs"
                      title="ลบข้อมูลลูกค้า"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {customer.notes && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">ข้อควรระวัง / หมายเหตุ:</p>
                      <p className="mt-0.5 leading-relaxed">{customer.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs: Pets vs History */}
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("pets")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "pets"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    สัตว์เลี้ยง ({customer.pets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "history"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    ประวัติบิล ({orders.length})
                  </button>
                </div>

                {activeTab === "pets" && (
                  <button
                    type="button"
                    onClick={() => onAddPet(customer)}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มสัตว์เลี้ยง</span>
                  </button>
                )}
              </div>

              {/* Tab 1: Pets List */}
              {activeTab === "pets" && (
                <div className="space-y-3">
                  {customer.pets.length === 0 ? (
                    <div className="py-10 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <p className="text-xs">ยังไม่มีข้อมูลสัตว์เลี้ยงในบ้านนี้</p>
                      <button
                        type="button"
                        onClick={() => onAddPet(customer)}
                        className="mt-2 text-xs font-bold text-amber-600 hover:underline"
                      >
                        + คลิกเพื่อเพิ่มสัตว์เลี้ยง
                      </button>
                    </div>
                  ) : (
                    customer.pets.map((pet) => {
                      const isDog = pet.species === "หมา";
                      const isCat = pet.species === "แมว";
                      const membership = pet.active_membership;
                      const coupons = pet.active_coupons || [];
                      const totalCouponBal = coupons.reduce((sum, c) => sum + Number(c.remaining_balance || 0), 0);

                      return (
                        <div
                          key={pet.id}
                          className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs hover:border-amber-400/60 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                                  isDog
                                    ? "bg-amber-100 text-amber-700"
                                    : isCat
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {isDog ? <Dog className="w-5 h-5" /> : isCat ? <Cat className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-bold text-stone-900">{pet.name}</h4>
                                  {pet.pet_code && (
                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px] font-mono font-bold text-stone-600 border border-stone-200">
                                      {pet.pet_code}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-500 mt-0.5">
                                  {pet.species} • {pet.breed || "ไม่ระบุพันธุ์"} • {pet.weight_kg ? `${pet.weight_kg} กก.` : "ไม่ระบุน้ำหนัก"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onEditPet(pet, customer)}
                                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                                title="แก้ไขสัตว์เลี้ยง"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePet(pet)}
                                disabled={deletingPetId === pet.id}
                                className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="ลบสัตว์เลี้ยง"
                              >
                                {deletingPetId === pet.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Badges: Membership & Coupons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {membership && membership.status !== "หมดอายุ" ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                                <Crown className="w-3.5 h-3.5 text-amber-600" />
                                <span>สมาชิกรายปี (หมดอายุ {membership.expire_date})</span>
                              </div>
                            ) : null}

                            {totalCouponBal > 0 && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                                <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                                <span>คูปองเงินสด ฿{totalCouponBal.toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Health Notes */}
                          {pet.health_notes && (
                            <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                              <span className="font-bold text-stone-700">หมายเหตุสุขภาพ: </span>
                              {pet.health_notes}
                            </p>
                          )}

                          {/* Quick POS Action */}
                          <div className="pt-2 border-t border-stone-100 flex items-center justify-end">
                            <Link
                              href={`/pos?petId=${pet.id}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>เปิดบิลคิดเงิน POS</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Order History */}
              {activeTab === "history" && (
                <div className="space-y-2.5">
                  {orders.length === 0 ? (
                    <div className="py-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-xs">
                      ยังไม่มีประวัติการเปิดบิลในระบบ
                    </div>
                  ) : (
                    orders.map((ord) => {
                      const isVoided = ord.status === "voided" || ord.status === "ยกเลิก";
                      return (
                        <div
                          key={ord.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isVoided
                              ? "bg-stone-50/70 border-stone-200 opacity-60"
                              : "bg-white border-stone-200 hover:border-amber-300 shadow-2xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-stone-900">
                                  {ord.order_number}
                                </span>
                                {isVoided && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                    ยกเลิกแล้ว
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-600 mt-0.5 line-clamp-1">
                                {ord.service_description || "บริการกรูมมิ่ง / สินค้าปลีก"}
                              </p>
                              {ord.pet?.name && (
                                <p className="text-[11px] text-stone-400 mt-0.5">
                                  น้อง {ord.pet.name} ({ord.pet.species})
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <p className="font-mono font-bold text-sm text-stone-900">
                                ฿{Number(ord.net_paid || 0).toLocaleString()}
                              </p>
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                {ord.order_date} • {ord.payment_method}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {orders.length > 0 && (
                    <div className="pt-2 text-center">
                      <Link
                        href="/orders"
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                      >
                        <span>ดูประวัติบิลทั้งหมดและพิมพ์สลิปในหน้ารายการบิล</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
