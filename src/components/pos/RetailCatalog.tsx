// components/pos/RetailCatalog.tsx
"use client";

import React, { useState, useMemo, useTransition } from "react";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag,
  PackagePlus,
  X,
  Loader2,
  Percent,
  CheckCircle2
} from "lucide-react";
import { Product } from "@/types/database";
import { CartItem, createProduct } from "@/app/actions/retail";

interface RetailCatalogProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onProductCreated?: (newProduct: Product) => void;
}

export default function RetailCatalog({
  products,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onProductCreated,
}: RetailCatalogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("ทั้งหมด");

  // Modal State สำหรับเพิ่มสินค้าและแบรนด์ใหม่
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formCalcMode, setFormCalcMode] = useState<"gp_rate" | "fixed_remit">("gp_rate");
  const [formGpPercent, setFormGpPercent] = useState("30");
  const [formRemitAmount, setFormRemitAmount] = useState("");

  // สร้างรายการแบรนด์สินค้าทั้งหมดจากฐานข้อมูลแบบ Dynamic (ไม่ Hardcode)
  const brandFilters = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand_group && p.brand_group.trim()) {
        brands.add(p.brand_group.trim());
      }
    });
    return ["ทั้งหมด", ...Array.from(brands).sort((a, b) => a.localeCompare(b, "th"))];
  }, [products]);

  // รายชื่อแบรนด์ที่มีอยู่เดิมสำหรับ Datalist Autocomplete
  const existingBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand_group && p.brand_group.trim()) {
        brands.add(p.brand_group.trim());
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b, "th"));
  }, [products]);

  // กรองสินค้าตามแบรนด์และคำค้นหา
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchBrand = selectedBrand === "ทั้งหมด" || p.brand_group === selectedBrand;
      const matchSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.product_code && p.product_code.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchBrand && matchSearch;
    });
  }, [products, selectedBrand, searchTerm]);

  // แมปจำนวนสินค้าในตะกร้าเพื่อแสดงปุ่ม
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.product.id, item.quantity));
    return map;
  }, [cart]);

  // คำนวณ Preview กำไร GP และยอดโอนคืนคู่ค้าในแบบฟอร์ม
  const priceNum = parseFloat(formSellingPrice) || 0;
  const gpPercentNum = parseFloat(formGpPercent) || 0;
  const remitNum = parseFloat(formRemitAmount) || 0;

  const previewCalc = useMemo(() => {
    if (formCalcMode === "gp_rate") {
      const gpRate = gpPercentNum / 100;
      const profit = Number((priceNum * gpRate).toFixed(2));
      const remit = Number((priceNum - profit).toFixed(2));
      return { gpRate, profit, remit };
    } else {
      const profit = Number((priceNum - remitNum).toFixed(2));
      const gpRate = priceNum > 0 ? Number((profit / priceNum).toFixed(4)) : 0;
      return { gpRate, profit, remit: remitNum };
    }
  }, [formCalcMode, priceNum, gpPercentNum, remitNum]);

  // Submit สร้างสินค้าใหม่
  const handleCreateProduct = () => {
    setFormError(null);
    if (!formName.trim()) {
      setFormError("กรุณากรอกชื่อสินค้า");
      return;
    }
    if (!formBrand.trim()) {
      setFormError("กรุณาระบุชื่อแบรนด์");
      return;
    }
    if (priceNum <= 0) {
      setFormError("ราคาขายต้องมากกว่า 0 บาท");
      return;
    }

    startTransition(async () => {
      const res = await createProduct({
        name: formName.trim(),
        brand_group: formBrand.trim(),
        selling_price: priceNum,
        gp_rate: previewCalc.gpRate,
        remit_amount: previewCalc.remit,
        cost_price: formCalcMode === "fixed_remit" ? remitNum : 0,
        is_active: true,
      });

      if (res.success && res.data) {
        if (onProductCreated) {
          onProductCreated(res.data);
        }
        setSelectedBrand(res.data.brand_group);
        setIsAddModalOpen(false);
        setFormName("");
        setFormBrand("");
        setFormSellingPrice("");
        setFormRemitAmount("");
        setFormGpPercent("30");
      } else {
        setFormError(res.error || "เกิดข้อผิดพลาดในการบันทึกสินค้า");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. ค้นหา & หมวดหมู่แบรนด์ */}
      <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า หรือ รหัสสินค้า..."
              enterKeyHint="search"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full text-base sm:text-xs pl-9 pr-4 py-2.5 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-stone-50/50"
            />
          </div>

          {/* ปุ่มเปิด Modal เพิ่มสินค้าและแบรนด์ใหม่ */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shadow-amber-600/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            title="เพิ่มสินค้าหรือแบรนด์ใหม่"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ เพิ่มสินค้า</span>
          </button>
        </div>

        {/* แถบชิปเลือกแบรนด์แบบ Dynamic */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {brandFilters.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => setSelectedBrand(brand)}
              className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer active:scale-95 ${
                selectedBrand === brand
                  ? "bg-stone-900 text-white border-stone-900 shadow-sm"
                  : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 active:bg-stone-200"
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </section>

      {/* 2. แคตตาล็อกสินค้าแบบ Grid */}
      <section className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold text-stone-600">
            สินค้า ({filteredProducts.length} รายการ)
          </span>
          {selectedBrand !== "ทั้งหมด" && (
            <button
              type="button"
              onClick={() => setSelectedBrand("ทั้งหมด")}
              className="text-[10px] text-amber-700 hover:underline font-medium"
            >
              แสดงทุกแบรนด์
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center text-stone-400 text-xs space-y-2">
            <p>ไม่พบรายการสินค้าที่ค้นหา</p>
            <button
              type="button"
              onClick={() => {
                setFormBrand(selectedBrand !== "ทั้งหมด" ? selectedBrand : "");
                setIsAddModalOpen(true);
              }}
              className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
            >
              + เพิ่มสินค้านี้เข้าสู่ระบบทันที
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((product) => {
              const qty = cartQtyMap.get(product.id) || 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-3 border border-stone-200/90 shadow-sm flex flex-col justify-between hover:border-amber-300 transition-all group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 truncate">
                        {product.brand_group}
                      </span>
                      {product.gp_rate > 0 ? (
                        <span className="text-[9px] text-stone-400 font-medium">
                          GP {Math.round(product.gp_rate * 100)}%
                        </span>
                      ) : (
                        <span className="text-[9px] text-stone-400 font-medium">
                          คืนทุน 100%
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-stone-800 line-clamp-2 leading-snug pt-0.5">
                      {product.name}
                    </h4>
                    {product.product_code && (
                      <p className="text-[10px] text-stone-400 font-mono">
                        {product.product_code}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-1 border-t border-stone-100">
                    <span className="text-sm font-black text-stone-900">
                      ฿{product.selling_price.toLocaleString()}
                    </span>

                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddToCart(product)}
                        className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200/80 flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-stone-100 rounded-xl p-1 border border-stone-200">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 active:scale-95 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black text-stone-800 px-1 min-w-[16px] text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. สรุปรายการในตะกร้า */}
      {cart.length > 0 && (
        <section className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>ตะกร้าสินค้า ({cart.reduce((a, b) => a + b.quantity, 0)} ชิ้น)</span>
            </h3>
          </div>

          <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="pr-2 max-w-[55%]">
                  <p className="font-bold text-stone-800 truncate">{product.name}</p>
                  <p className="text-[10px] text-stone-400">
                    ฿{product.selling_price} × {quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-stone-900">
                    ฿{(product.selling_price * quantity).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFromCart(product.id)}
                    className="text-stone-300 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Modal เพิ่มสินค้าและแบรนด์ใหม่ (Dynamic Product & Brand Creation) */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-t-[28px] sm:rounded-3xl shadow-2xl border-t sm:border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-250 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-stone-900 leading-tight">
                    เพิ่มสินค้า / แบรนด์ใหม่
                  </h3>
                  <p className="text-[10px] text-stone-400">บันทึกลง Database ทันที</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                  {formError}
                </div>
              )}

              {/* ชื่อสินค้า */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  ชื่อสินค้า *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ขนมขัดฟันรสแกะ, แชมพูสูตรขนยาว"
                  autoCorrect="off"
                  autoCapitalize="words"
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-base sm:text-xs"
                />
              </div>

              {/* แบรนด์สินค้า */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  แบรนด์ / คู่ค้า (พิมพ์ชื่อใหม่ หรือ เลือกจากที่มี) *
                </label>
                <input
                  type="text"
                  list="brand-suggestions"
                  value={formBrand}
                  onChange={(e) => setFormBrand(e.target.value)}
                  placeholder="เช่น HiDREAM, Kasty, หรือชื่อแบรนด์ใหม่..."
                  autoCorrect="off"
                  autoCapitalize="words"
                  className="w-full min-h-[44px] p-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-base sm:text-xs"
                />
                <datalist id="brand-suggestions">
                  {existingBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
                <span className="text-[10px] text-stone-400 mt-0.5 block">
                  * หากพิมพ์ชื่อแบรนด์ใหม่ ระบบจะเพิ่มเข้าสู่รายการ Settlement ให้อัตโนมัติ
                </span>
              </div>

              {/* ราคาขาย */}
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  ราคาขายหน้าร้าน (บาท) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">฿</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[44px] p-2.5 pl-7 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold text-base sm:text-sm text-stone-900"
                  />
                </div>
              </div>

              {/* วิธีคำนวณส่วนแบ่ง GP หรือ ยอดโอนคืน */}
              <div className="space-y-2 pt-1 border-t border-stone-100">
                <label className="font-semibold text-stone-700 block">
                  รูปแบบส่วนแบ่งร้าน & คู่ค้าฝากขาย
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormCalcMode("gp_rate")}
                    className={`min-h-[42px] p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      formCalcMode === "gp_rate"
                        ? "bg-amber-50 text-amber-950 border-amber-300 shadow-sm"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    กำหนด % GP ร้าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCalcMode("fixed_remit")}
                    className={`min-h-[42px] p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                      formCalcMode === "fixed_remit"
                        ? "bg-amber-50 text-amber-950 border-amber-300 shadow-sm"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    กำหนดยอดโอนคู่ค้า/ทุน
                  </button>
                </div>

                {formCalcMode === "gp_rate" ? (
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-500 block">
                      อัตรา GP ร้าน (%) เช่น 30% หรือ 25% (0% = คืนทุนเต็ม)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={formGpPercent}
                        onChange={(e) => setFormGpPercent(e.target.value)}
                        placeholder="30"
                        className="w-full min-h-[44px] p-2.5 pr-8 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold text-base sm:text-sm"
                      />
                      <Percent className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] text-stone-500 block">
                      ยอดเคลียร์คืนคู่ค้า / ราคาทุนต่อชิ้น (บาท)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">฿</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={formRemitAmount}
                        onChange={(e) => setFormRemitAmount(e.target.value)}
                        placeholder="0"
                        className="w-full min-h-[44px] p-2.5 pl-7 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold text-base sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Preview Calculation Card */}
                {priceNum > 0 && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1 text-[11px]">
                    <span className="font-bold text-stone-600 block">ผลการคำนวณส่วนแบ่งอัตโนมัติ:</span>
                    <div className="flex justify-between text-emerald-700">
                      <span>• โอนคืนคู่ค้า (Remit):</span>
                      <span className="font-bold">฿{previewCalc.remit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-900 font-bold">
                      <span>• กำไร GP ร้าน (Shop Profit):</span>
                      <span>฿{previewCalc.profit.toLocaleString()} ({(previewCalc.gpRate * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreateProduct}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>บันทึกสินค้า</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
