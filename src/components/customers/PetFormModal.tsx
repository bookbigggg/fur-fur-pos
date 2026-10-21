"use client";

import React, { useState, useEffect } from "react";
import { X, Dog, Cat, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Species, Pet } from "@/types/database";
import { addPet, updatePet } from "@/app/actions/customers";

interface PetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (petId?: string) => void;
  customerId: string;
  customerName?: string;
  initialPet?: Pet | null;
}

export default function PetFormModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  customerName,
  initialPet,
}: PetFormModalProps) {
  const isEdit = Boolean(initialPet);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("หมา");
  const [breed, setBreed] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPet) {
      setName(initialPet.name || "");
      setSpecies(initialPet.species || "หมา");
      setBreed(initialPet.breed || "");
      setWeightKg(initialPet.weight_kg !== null && initialPet.weight_kg !== undefined ? String(initialPet.weight_kg) : "");
      setHealthNotes(initialPet.health_notes || "");
    } else {
      setName("");
      setSpecies("หมา");
      setBreed("");
      setWeightKg("");
      setHealthNotes("");
    }
    setError(null);
  }, [initialPet, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อสัตว์เลี้ยง");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && initialPet) {
        const res = await updatePet(initialPet.id, {
          name: name.trim(),
          species,
          breed: breed.trim() || undefined,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          healthNotes: healthNotes.trim() || undefined,
        });

        if (!res.success) {
          setError(res.error || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
          setIsSubmitting(false);
          return;
        }
        onSuccess(initialPet.id);
      } else {
        const res = await addPet({
          customerId,
          name: name.trim(),
          species,
          breed: breed.trim() || undefined,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          healthNotes: healthNotes.trim() || undefined,
        });

        if (!res.success) {
          setError(res.error || "ไม่สามารถเพิ่มสัตว์เลี้ยงได้");
          setIsSubmitting(false);
          return;
        }
        onSuccess(res.petId);
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-stone-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? "แก้ไขข้อมูลสัตว์เลี้ยง" : "เพิ่มสัตว์เลี้ยงใหม่"}
              </h2>
              <p className="text-xs text-stone-400">
                {customerName ? `ในบ้านคุณ ${customerName}` : "กรอกข้อมูลสัตว์เลี้ยง"}
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
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              ชื่อสัตว์เลี้ยง <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น บราวนี่, มิดไนท์"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              ประเภทสัตว์เลี้ยง
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSpecies("หมา")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  species === "หมา"
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                    : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                }`}
              >
                <Dog className="w-4 h-4" />
                <span>หมา</span>
              </button>
              <button
                type="button"
                onClick={() => setSpecies("แมว")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  species === "แมว"
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                    : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                }`}
              >
                <Cat className="w-4 h-4" />
                <span>แมว</span>
              </button>
              <button
                type="button"
                onClick={() => setSpecies("อื่นๆ")}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  species === "อื่นๆ"
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                    : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
                }`}
              >
                <span>อื่นๆ</span>
              </button>
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
                placeholder="เช่น ชิสุห์, คอร์กี้"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white"
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
                placeholder="เช่น 5.2"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              ข้อควรระวัง / ประวัติสุขภาพ
            </label>
            <textarea
              rows={2}
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="เช่น ขี้ตกใจ, ดุเวลาตัดเล็บ, ผิวแพ้ง่าย"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-base md:text-sm bg-white resize-none"
            />
          </div>

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
                <span>{isEdit ? "บันทึกการแก้ไข" : "เพิ่มสัตว์เลี้ยง"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
