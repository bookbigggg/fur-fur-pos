"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  Search, 
  UserPlus, 
  User, 
  ShieldCheck, 
  Ticket, 
  Check, 
  X, 
  Loader2,
  ChevronRight,
  Phone,
  Clock,
  AlertCircle
} from "lucide-react";
import { PetSearchResult, searchPetsAndCustomers, createQuickCustomerAndPet } from "@/app/actions/customers";
import { Species } from "@/types/database";

interface PetSelectorProps {
  selectedPet: PetSearchResult | null;
  onSelectPet: (pet: PetSearchResult | null) => void;
}

export default function PetSelector({ selectedPet, onSelectPet }: PetSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<PetSearchResult[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [isSavingPet, startSave] = useTransition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("หมา");
  const [breed, setBreed] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const data = await searchPetsAndCustomers(searchTerm);
        setResults(data);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim().length < 2) {
      setResults([]);
    }
  };

  const handleSelect = (pet: PetSearchResult) => {
    // ปิดคีย์บอร์ดบนมือถือทันทีเมื่อเลือกลูกค้าเสร็จ ป้องกันค้างสถานะบน iOS
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onSelectPet(pet);
    setSearchTerm("");
    setResults([]);
  };

  const handleCreateCustomer = () => {
    setModalError(null);
    startSave(async () => {
      const res = await createQuickCustomerAndPet({
        customerName,
        customerPhone,
        petName,
        species,
        breed,
        weightKg: weightKg ? parseFloat(weightKg) : null,
      });

      if (res.success && res.pet) {
        if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onSelectPet(res.pet);
        setIsModalOpen(false);
        setCustomerName("");
        setCustomerPhone("");
        setPetName("");
        setBreed("");
        setWeightKg("");
      } else {
        setModalError(res.error || "ไม่สามารถบันทึกได้");
      }
    });
  };

  if (selectedPet) {
    const totalCouponBalance = selectedPet.active_coupons?.reduce((acc, c) => acc + c.remaining_balance, 0) || 0;

    return (
      <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-base">
              {selectedPet.species === "แมว" ? "🐱" : "🐶"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-stone-900 text-base">{selectedPet.name}</span>
                {selectedPet.active_membership && (
                  selectedPet.active_membership.status === "หมดอายุ" ? (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200">
                      <AlertCircle className="w-3 h-3 text-rose-600" />
                      Member หมดอายุแล้ว
                    </span>
                  ) : selectedPet.active_membership.status === "ใกล้หมดอายุ" ? (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      <Clock className="w-3 h-3 text-amber-700" />
                      Member ใกล้หมดอายุ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Member 299 (-10%)
                    </span>
                  )
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                เจ้าของ: <span className="font-medium text-stone-700">{selectedPet.customer?.name}</span>
                {selectedPet.customer?.phone && ` (${selectedPet.customer.phone})`}
              </p>
              <p className="text-[11px] text-stone-400">
                {selectedPet.species} • {selectedPet.breed || "ไม่ระบุพันธุ์"} {selectedPet.weight_kg && `• ${selectedPet.weight_kg} kg`}
                {selectedPet.active_membership?.expire_date && (
                  <span> • สมาชิกถึง {new Date(selectedPet.active_membership.expire_date).toLocaleDateString("th-TH")}</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectPet(null)}
            className="text-xs text-amber-700 hover:text-amber-800 font-bold bg-amber-50 hover:bg-amber-100/70 border border-amber-200 px-2.5 py-1.5 rounded-xl transition-all"
          >
            เปลี่ยน
          </button>
        </div>

        {totalCouponBalance > 0 && (
          <div className="bg-amber-50/70 rounded-xl px-3 py-2 border border-amber-200/70 flex items-center justify-between text-xs text-amber-900 font-medium">
            <div className="flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-amber-700" />
              <span>คูปองคงเหลือ</span>
            </div>
            <span className="font-extrabold text-amber-800">
              ฿{totalCouponBalance.toLocaleString()}
            </span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
          <User className="w-4 h-4 text-amber-600" />
          เลือกลูกค้า / สัตว์เลี้ยง
        </label>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 active:bg-amber-100 px-3 py-2 min-h-[38px] rounded-xl border border-amber-200 transition-all cursor-pointer active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ ลูกค้าใหม่</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="ค้นหาด้วยเบอร์โทร, ชื่อสัตว์เลี้ยง, หรือชื่อลูกค้า..."
          enterKeyHint="search"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full text-base sm:text-xs pl-9 pr-8 py-2.5 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
        />
        {isSearching && (
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {results.length > 0 && (
        <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
          {results.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => handleSelect(pet)}
              className="w-full text-left p-3 min-h-[48px] hover:bg-stone-50 active:bg-amber-50/40 transition-colors flex items-center justify-between group cursor-pointer active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-stone-900">{pet.name}</span>
                  <span className="text-[11px] text-stone-500 font-medium">({pet.customer?.name})</span>
                  {pet.active_membership && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      pet.active_membership.status === "หมดอายุ"
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : pet.active_membership.status === "ใกล้หมดอายุ"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {pet.active_membership.status === "หมดอายุ"
                        ? "Member หมดอายุ"
                        : pet.active_membership.status === "ใกล้หมดอายุ"
                        ? "299 ใกล้หมดอายุ"
                        : "Member 299"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                  {pet.customer?.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone className="w-3 h-3" />
                      {pet.customer.phone}
                    </span>
                  )}
                  <span>• {pet.breed || pet.species}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-amber-600 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-t-[28px] sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border-t sm:border border-stone-200 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 max-h-[90vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="flex justify-between items-center pb-2.5 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-amber-600" />
                <span>เพิ่มลูกค้าและสัตว์เลี้ยงใหม่ (Walk-in)</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl font-medium border border-rose-200">
                {modalError}
              </p>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">ชื่อลูกค้า *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="เช่น คุณกานต์"
                  autoCorrect="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  enterKeyHint="next"
                  className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">ชื่อสัตว์เลี้ยง *</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="เช่น โคล่า"
                    autoCorrect="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">ประเภท</label>
                  <select
                    value={species}
                    onChange={(e) => setSpecies(e.target.value as Species)}
                    className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="หมา">🐶 หมา</option>
                    <option value="แมว">🐱 แมว</option>
                    <option value="อื่นๆ">🐾 อื่นๆ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">สายพันธุ์</label>
                  <input
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="เช่น พุดเดิ้ล"
                    autoCorrect="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">น้ำหนัก (kg)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="0.0"
                    enterKeyHint="done"
                    className="w-full p-3 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-stone-600 font-bold border border-stone-200 hover:bg-stone-50 active:bg-stone-100 text-xs transition-colors cursor-pointer active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={isSavingPet || !customerName.trim() || !petName.trim()}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {isSavingPet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>บันทึกและเลือก</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
