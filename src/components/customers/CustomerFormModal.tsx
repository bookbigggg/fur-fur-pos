"use client";

import React, { useState, useEffect } from "react";
import { X, User, Phone, FileText, Dog, Cat, Sparkles, Loader2 } from "lucide-react";
import { Species } from "@/types/database";
import { createCustomer, updateCustomer } from "@/app/actions/customers";

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customerId?: string) => void;
  initialCustomer?: {
    id: string;
    name: string;
    phone?: string | null;
    notes?: string | null;
  } | null;
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialCustomer,
}: CustomerFormModalProps) {
  const isEdit = Boolean(initialCustomer);

  // Customer state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Initial pet state (Create mode only)
  const [includePet, setIncludePet] = useState(true);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("หมา");
  const [breed, setBreed] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialCustomer) {
      setName(initialCustomer.name || "");
      setPhone(initialCustomer.phone || "");
      setNotes(initialCustomer.notes || "");
    } else {
      setName("");
      setPhone("");
      setNotes("");
      setIncludePet(true);
      setPetName("");
      setSpecies("หมา");
      setBreed("");
      setWeightKg("");
      setHealthNotes("");
    }
    setError(null);
  }, [initialCustomer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    if (!isEdit && includePet && !petName.trim()) {
      setError("กรุณากรอกชื่อสัตว์เลี้ยง หรือยกเลิกการเพิ่มสัตว์เลี้ยง");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && initialCustomer) {
        const res = await updateCustomer(initialCustomer.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        if (!res.success) {
          setError(res.error || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
          setIsSubmitting(false);
          return;
        }
        onSuccess(initialCustomer.id);
      } else {
        const res = await createCustomer({
          name: name.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          petName: includePet && petName.trim() ? petName.trim() : undefined,
          species: includePet ? species : undefined,
          breed: includePet && breed.trim() ? breed.trim() : undefined,
          weightKg: includePet && weightKg ? parseFloat(weightKg) : null,
          healthNotes: includePet && healthNotes.trim() ? healthNotes.trim() : undefined,
        });

        if (!res.success) {
          setError(res.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
          setIsSubmitting(false);
          return;
        }
        onSuccess(res.customerId);
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่"}
              </h2>
              <p className="text-xs text-stone-400">
                {isEdit ? "ปรับปรุงข้อมูลติดต่อและบันทึกข้อควรระวัง" : "กรอกข้อมูลลูกค้าและสัตว์เลี้ยงเพื่อเปิดประวัติ"}
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Customer Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-amber-600" />
              <span>ข้อมูลลูกค้า</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ชื่อลูกค้า <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คุณแอน, พี่บุ๊ค"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 0812345678"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                หมายเหตุ / ข้อควรระวังลูกค้า
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none text-stone-400">
                  <FileText className="w-4 h-4" />
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="เช่น ลูกค้าประจำชอบช่างคนเดิม, ส่งรูปทาง LINE ทุกครั้ง"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Pet Section (Create mode only) */}
          {!isEdit && (
            <div className="pt-3 border-t border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>สัตว์เลี้ยงแรกเริ่ม</span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePet}
                    onChange={(e) => setIncludePet(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300"
                  />
                  <span>เพิ่มสัตว์เลี้ยงพร้อมกัน</span>
                </label>
              </div>

              {includePet && (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ชื่อสัตว์เลี้ยง <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={petName}
                        onChange={(e) => setPetName(e.target.value)}
                        placeholder="เช่น บราวนี่, มิดไนท์"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ประเภท
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSpecies("หมา")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            species === "หมา"
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                          }`}
                        >
                          <Dog className="w-3.5 h-3.5" />
                          <span>หมา</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecies("แมว")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            species === "แมว"
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                          }`}
                        >
                          <Cat className="w-3.5 h-3.5" />
                          <span>แมว</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecies("อื่นๆ")}
                          className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            species === "อื่นๆ"
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                          }`}
                        >
                          <span>อื่นๆ</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        สายพันธุ์
                      </label>
                      <input
                        type="text"
                        value={breed}
                        onChange={(e) => setBreed(e.target.value)}
                        placeholder="เช่น ชิสุห์, โกลเด้น, สก๊อตติช"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        น้ำหนัก (กก.)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        placeholder="เช่น 4.5"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ข้อควรระวัง / พฤติกรรมน้อง
                    </label>
                    <input
                      type="text"
                      value={healthNotes}
                      onChange={(e) => setHealthNotes(e.target.value)}
                      placeholder="เช่น ขี้ตกใจ, ดุเวลาจับเท้า, แพ้แชมพูบางยี่ห้อ"
                      className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-bold hover:bg-stone-100 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>{isEdit ? "บันทึกการแก้ไข" : "สร้างข้อมูลลูกค้า"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
