// app/pos/page.tsx
"use client";

import PackagePurchase from "@/components/pos/PackagePurchase";
import React, { useState, useEffect, useMemo, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Scissors, 
  ShoppingBag, 
  Sparkles, 
  QrCode, 
  Banknote, 
  Ticket, 
  CheckCircle2, 
  Loader2, 
  Check,
  AlertCircle,
  Clock,
  Tag,
  Calendar,
  RotateCcw,
  Trash2,
  Receipt,
  Copy,
  X
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { PaymentMethod, Product, Coupon } from "@/types/database";
import { createGroomingOrder, GroomingPetItemInput } from "@/app/actions/checkout";
import { getActiveProducts, createRetailOrder, CartItem } from "@/app/actions/retail";
import { PetSearchResult, getPetById, getPetsByCustomerId } from "@/app/actions/customers";
import { getOrderDetail, OrderDetailResult } from "@/app/actions/orders";
import { useStoreSettings } from "@/lib/settings";
import { STORE_PROFILE } from "@/lib/store-profile";
import { copyToClipboard } from "@/lib/clipboard";
import PetSelector from "@/components/pos/PetSelector";
import RetailCatalog from "@/components/pos/RetailCatalog";
import ReceiptModal from "@/components/orders/ReceiptModal";

export interface GroomingServiceLine {
  id: string;
  pet: PetSearchResult;
  serviceDesc: string;
  priceInput: string;
  discountMode: "percent" | "baht";
  selectedDiscount: string;
  bahtDiscountInput: string;
}

function AccessDeniedBanner() {
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const isDenied = searchParams.get("denied") === "1";

  if (!isDenied || dismissed) return null;

  return (
    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-rose-800 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2 max-w-xl mx-auto w-full">
        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        <span className="flex-1">
          <strong>การเข้าถึงถูกจำกัด:</strong> บัญชีพนักงาน (Staff) ไม่มีสิทธิ์เข้าถึงหน้างบกำไร-ขาดทุนหรือเคลียร์เงินคู่ค้า ข้อมูลถูกจำกัดเฉพาะเจ้าของ/ผู้จัดการร้าน
        </span>
        <button 
          type="button" 
          onClick={() => setDismissed(true)}
          className="text-rose-500 hover:text-rose-700 font-bold ml-2 text-sm px-1.5 py-0.5 rounded transition-colors"
          title="ปิดการแจ้งเตือน"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const QUICK_CHIPS = ["[อาบ]", "[อาบตัด]", "[สปา]", "[ไถเท้า]", "[แปรงฟัน]", "[สางขน]"];
const DISCOUNT_OPTIONS = ["0%", "10%", "20%", "25%"];

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function POSContent() {
  const searchParams = useSearchParams();
  const initialPetId = searchParams.get("petId");
  const { settings } = useStoreSettings();
  const todayDate = useMemo(() => getBangkokDate(), []);
  const [orderDate, setOrderDate] = useState<string>(getBangkokDate());
  const [activeTab, setActiveTab] = useState<"grooming" | "retail" | "package">("grooming");
  const [isPending, startTransition] = useTransition();

  // Master Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // โหลดรายการสินค้าจาก Supabase เมื่อเปิดหน้า
  useEffect(() => {
    async function loadProducts() {
      const data = await getActiveProducts();
      setProducts(data);
    }
    loadProducts();
  }, []);

  // Shared State: ลูกค้า/สัตว์เลี้ยงหลัก
  const [selectedPet, setSelectedPet] = useState<PetSearchResult | null>(null);
  const [householdPets, setHouseholdPets] = useState<PetSearchResult[]>([]);

  // Multi-Pet Grooming Service Lines State
  const [groomingLines, setGroomingLines] = useState<GroomingServiceLine[]>([]);
  const [useCoupon, setUseCoupon] = useState<boolean>(false);
  const [staffCommission, setStaffCommission] = useState<string>("0");

  // Shared Payment Method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("โอนเงิน/QR");

  // Success / Error Modal
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Receipt Modal State สำหรับหน้า POS (เปิดอัตโนมัติเมื่อคิดเงินสำเร็จ)
  const [createdOrderDetail, setCreatedOrderDetail] = useState<OrderDetailResult | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Quick Bank & QR Preview State
  const [copiedAccountQuick, setCopiedAccountQuick] = useState(false);
  const [showQRPreview, setShowQRPreview] = useState(false);

  // ดึงสัตว์เลี้ยงตัวอื่นๆ ในบ้านเดียวกันเมื่อเลือกลูกค้า
  useEffect(() => {
    if (selectedPet?.customer_id) {
      getPetsByCustomerId(selectedPet.customer_id).then((pets) => {
        setHouseholdPets(pets);
      });
    } else {
      setHouseholdPets([]);
    }
  }, [selectedPet?.customer_id]);

  // คัดกรองสัตว์เลี้ยงในบ้านที่ยังไม่ได้ถูกเพิ่มในบิล
  const availableHouseholdPets = useMemo(() => {
    return householdPets.filter(
      (hp) => !groomingLines.some((line) => line.pet.id === hp.id)
    );
  }, [householdPets, groomingLines]);

  // เลือกสัตว์เลี้ยงหลักจาก PetSelector
  const handleSelectPrimaryPet = (pet: PetSearchResult | null) => {
    setSelectedPet(pet);
    if (!pet) {
      setGroomingLines([]);
      setHouseholdPets([]);
      setUseCoupon(false);
      return;
    }
    const isMember =
      pet.active_membership?.status === "ใช้งานได้" ||
      pet.active_membership?.status === "ใกล้หมดอายุ";

    setGroomingLines([
      {
        id: pet.id,
        pet,
        serviceDesc: "",
        priceInput: "",
        discountMode: "percent",
        selectedDiscount: isMember ? "10%" : "0%",
        bahtDiscountInput: "",
      },
    ]);
  };

  // เลือกลูกค้า/สัตว์เลี้ยงอัตโนมัติหากมี petId ส่งมาจากหน้ารายชื่อลูกค้า
  useEffect(() => {
    if (initialPetId) {
      getPetById(initialPetId).then((pet) => {
        if (pet) {
          handleSelectPrimaryPet(pet);
        }
      });
    }
  }, [initialPetId]);

  // เพิ่มสัตว์เลี้ยงตัวอื่นในบ้านเข้าบิล Grooming
  const handleAddHouseholdPet = (pet: PetSearchResult) => {
    const isMember =
      pet.active_membership?.status === "ใช้งานได้" ||
      pet.active_membership?.status === "ใกล้หมดอายุ";

    setGroomingLines((prev) => [
      ...prev,
      {
        id: `${pet.id}-${Date.now()}`,
        pet,
        serviceDesc: "",
        priceInput: "",
        discountMode: "percent",
        selectedDiscount: isMember ? "10%" : "0%",
        bahtDiscountInput: "",
      },
    ]);
  };

  // ลบสัตว์เลี้ยงออกจากบิล Grooming
  const handleRemoveGroomingLine = (index: number) => {
    setGroomingLines((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setSelectedPet(null);
      } else if (index === 0) {
        setSelectedPet(updated[0].pet);
      }
      return updated;
    });
  };

  // อัปเดตข้อมูลของสัตว์เลี้ยงแต่ละตัว
  const handleUpdateLine = (index: number, updates: Partial<GroomingServiceLine>) => {
    setGroomingLines((prev) =>
      prev.map((line, idx) => (idx === index ? { ...line, ...updates } : line))
    );
  };

  // คำนวณยอดเงินและส่วนลดของแต่ละตัว
  const calculateLineValues = (line: GroomingServiceLine) => {
    const numericPrice = parseFloat(line.priceInput) || 0;
    if (numericPrice <= 0) {
      return { numericPrice: 0, discountBaht: 0, finalDiscountText: "0%", netPrice: 0 };
    }
    let discountBaht = 0;
    let finalDiscountText = "0%";
    if (line.discountMode === "percent") {
      const rate = (parseInt(line.selectedDiscount, 10) || 0) / 100;
      discountBaht = Math.min(numericPrice, Math.round(numericPrice * rate));
      finalDiscountText = line.selectedDiscount;
    } else {
      const inputBaht = parseFloat(line.bahtDiscountInput) || 0;
      discountBaht = Math.min(numericPrice, Math.max(0, inputBaht));
      finalDiscountText = discountBaht > 0 ? `฿${discountBaht.toLocaleString()}` : "0%";
    }
    const netPrice = Math.max(0, numericPrice - discountBaht);
    return { numericPrice, discountBaht, finalDiscountText, netPrice };
  };

  const calculatedGroomingLines = useMemo(() => {
    return groomingLines.map((line) => ({
      ...line,
      ...calculateLineValues(line),
    }));
  }, [groomingLines]);

  const totalGroomingFullPrice = useMemo(() => {
    return calculatedGroomingLines.reduce((sum, line) => sum + line.numericPrice, 0);
  }, [calculatedGroomingLines]);

  const totalGroomingDiscountBaht = useMemo(() => {
    return calculatedGroomingLines.reduce((sum, line) => sum + line.discountBaht, 0);
  }, [calculatedGroomingLines]);

  const totalGroomingNetPrice = useMemo(() => {
    return calculatedGroomingLines.reduce((sum, line) => sum + line.netPrice, 0);
  }, [calculatedGroomingLines]);

  // ตรวจจับคูปองคงเหลือที่ใช้งานได้ของลูกค้า/สัตว์เลี้ยงในบ้าน
  const availableCoupons = useMemo(() => {
    const couponsMap = new Map<string, Coupon>();
    selectedPet?.active_coupons?.forEach((c) => {
      if (c.status === "ใช้งานได้" && c.remaining_balance > 0) {
        couponsMap.set(c.id, c);
      }
    });
    householdPets.forEach((p) => {
      p.active_coupons?.forEach((c) => {
        if (c.status === "ใช้งานได้" && c.remaining_balance > 0) {
          couponsMap.set(c.id, c);
        }
      });
    });
    return Array.from(couponsMap.values());
  }, [selectedPet, householdPets]);

  const activeCoupon = availableCoupons[0] || null;

  useEffect(() => {
    if (activeCoupon) {
      setUseCoupon(true);
    } else {
      setUseCoupon(false);
    }
  }, [activeCoupon?.id]);

  // คำนวณการหักคูปอง
  const { couponDeducted, remainingPay: groomingRemainingPay } = useMemo(() => {
    if (!useCoupon || !activeCoupon || totalGroomingNetPrice <= 0) {
      return { couponDeducted: 0, remainingPay: totalGroomingNetPrice };
    }
    const deducted = Math.min(activeCoupon.remaining_balance, totalGroomingNetPrice);
    return { couponDeducted: deducted, remainingPay: totalGroomingNetPrice - deducted };
  }, [useCoupon, activeCoupon, totalGroomingNetPrice]);

  // คำนวณยอดรวมฝั่ง Retail
  const retailTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);
  }, [cart]);

  // ตรวจสอบว่ามีบริการ Grooming และ สินค้าปลีก อยู่ในบิลหรือไม่
  const hasGrooming = useMemo(() => {
    return calculatedGroomingLines.some(
      (line) => line.numericPrice > 0 && Boolean(line.serviceDesc.trim())
    );
  }, [calculatedGroomingLines]);

  const hasRetail = cart.length > 0;

  // คำนวณยอดเงินที่ต้องชำระสุทธิ (Grooming + Retail)
  const currentPayable = useMemo(() => {
    let sum = 0;
    if (hasGrooming) sum += groomingRemainingPay;
    if (hasRetail) sum += retailTotal;
    return sum;
  }, [hasGrooming, groomingRemainingPay, hasRetail, retailTotal]);

  useEffect(() => {
    queueMicrotask(() => {
      if (activeTab !== "package") {
        if (currentPayable === 0 && couponDeducted > 0) {
          setPaymentMethod("หักคูปอง");
        } else if (currentPayable > 0 && paymentMethod === "หักคูปอง") {
          setPaymentMethod("โอนเงิน/QR");
        }
      }
    });
  }, [currentPayable, couponDeducted, paymentMethod, activeTab]);

  // Cart Operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // รีเซ็ตฟอร์ม
  const handleResetForm = () => {
    setGroomingLines([]);
    setSelectedPet(null);
    setHouseholdPets([]);
    setStaffCommission("0");
    setCart([]);
    setErrorMessage(null);
    setSuccessOrderNumber(null);
    setSuccessNote(null);
    setCreatedOrderDetail(null);
    setIsReceiptOpen(false);
    setUseCoupon(false);
    setOrderDate(getBangkokDate());
  };

  // ดำเนินการเปิดบิล (รองรับทั้ง Grooming หลายตัว, ขายปลีก, และบิลรวม Grooming+สินค้า)
  const handleCheckout = () => {
    setErrorMessage(null);

    startTransition(async () => {
      // 1. กรณีมีบริการ Grooming (ไม่ว่าจะมีสินค้าปลีกพ่วงด้วยหรือไม่) -> เปิดบิล Grooming / บิลรวม
      if (hasGrooming) {
        if (!selectedPet) {
          setErrorMessage("กรุณาเลือกลูกค้าหรือสัตว์เลี้ยงก่อนเปิดบิล Grooming");
          return;
        }

        const validLines = calculatedGroomingLines.filter(
          (line) => line.numericPrice > 0 && Boolean(line.serviceDesc.trim())
        );

        if (validLines.length === 0) {
          setErrorMessage("กรุณาระบุรายละเอียดบริการและราคาของสัตว์เลี้ยงให้ครบถ้วน");
          return;
        }

        const groomingItemsPayload: GroomingPetItemInput[] = validLines.map((line) => ({
          petId: line.pet.id,
          petName: line.pet.name,
          species: line.pet.species,
          breed: line.pet.breed,
          serviceDescription: line.serviceDesc,
          fullPrice: line.numericPrice,
          discountText: line.finalDiscountText,
          discountBaht: line.discountBaht,
          netPrice: line.netPrice,
        }));

        const combinedGroomingFullPrice = validLines.reduce((s, l) => s + l.numericPrice, 0);
        const combinedDiscountBaht = validLines.reduce((s, l) => s + l.discountBaht, 0);
        const combinedDiscountText =
          validLines.length === 1
            ? validLines[0].finalDiscountText
            : combinedDiscountBaht > 0
            ? `ลดรวม ฿${combinedDiscountBaht.toLocaleString()}`
            : "0%";

        const combinedServiceDesc =
          validLines.length === 1
            ? validLines[0].serviceDesc
            : validLines
                .map((l) => `[${l.pet.name}] ${l.serviceDesc.trim()} ฿${l.netPrice.toLocaleString()}`)
                .join(" • ");

        const combinedNetPaid = groomingRemainingPay + (hasRetail ? retailTotal : 0);

        const result = await createGroomingOrder({
          customerId: selectedPet.customer?.id,
          petId: selectedPet.id,
          serviceDescription: combinedServiceDesc,
          fullPrice: combinedGroomingFullPrice,
          discountText: combinedDiscountText,
          couponId: couponDeducted > 0 ? activeCoupon?.id : null,
          couponDeducted,
          netPaid: combinedNetPaid,
          staffCommission: settings.enableStaffCommission ? (parseFloat(staffCommission) || 0) : 0,
          paymentMethod,
          retailItems: hasRetail ? cart : [],
          orderDate,
          groomingItems: groomingItemsPayload,
        });

        if (result.success && result.orderNumber) {
          setSuccessOrderNumber(result.orderNumber);
          const petCountText = validLines.length > 1 ? ` (น้องๆ ${validLines.length} ตัว)` : "";
          if (hasRetail) {
            setSuccessNote(`บิลรวม (Grooming${petCountText} + สินค้าปลีก ${cart.length} รายการ) • ยอดชำระ ฿${combinedNetPaid.toLocaleString()}`);
          } else {
            setSuccessNote(`บิลบริการ Grooming${petCountText}`);
          }

          // โหลดข้อมูลสลิปและเปิด ReceiptModal ทันที
          try {
            const detail = await getOrderDetail(result.orderNumber);
            if (detail) {
              setCreatedOrderDetail(detail);
              setIsReceiptOpen(true);
            }
          } catch (e) {
            console.error("Failed to load grooming order detail:", e);
          }
        } else {
          setErrorMessage(result.error || "เกิดข้อผิดพลาดในการบันทึกบิล");
        }
      } else if (hasRetail) {
        // 2. กรณีไม่มี Grooming มีเฉพาะสินค้าปลีกอย่างเดียว
        const result = await createRetailOrder({
          customerId: selectedPet?.customer?.id,
          petId: selectedPet?.id,
          items: cart,
          paymentMethod,
          orderDate,
        });

        if (result.success && result.orderNumber) {
          setSuccessOrderNumber(result.orderNumber);
          setSuccessNote(`บิลขายปลีก • กำไรร้าน ฿${result.shopProfit?.toLocaleString()} • เคลียร์คู่ค้า ฿${result.remitTotal?.toLocaleString()}`);

          // โหลดข้อมูลสลิปและเปิด ReceiptModal ทันที
          try {
            const detail = await getOrderDetail(result.orderNumber);
            if (detail) {
              setCreatedOrderDetail(detail);
              setIsReceiptOpen(true);
            }
          } catch (e) {
            console.error("Failed to load retail order detail:", e);
          }
        } else {
          setErrorMessage(result.error || "เกิดข้อผิดพลาดในการบันทึกบิล");
        }
      } else {
        setErrorMessage("กรุณาระบุรายละเอียดบริการ Grooming หรือเลือกสินค้าปลีกก่อนเปิดบิล");
      }
    });
  };

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-800 flex flex-col pb-36">
      {/* Top Navbar */}
      <Navbar subtitle="ระบบคิดเงินหน้าร้าน" />

      {/* Access Denied Warning Banner */}
      <Suspense fallback={null}>
        <AccessDeniedBanner />
      </Suspense>

      {/* Tab Switcher */}
      <div className="bg-white border-b border-stone-200 px-4 py-2 sticky top-[calc(57px+env(safe-area-inset-top))] z-20 shadow-sm">
        <div className="max-w-xl mx-auto grid grid-cols-3 p-1 bg-stone-100 rounded-xl gap-1 border border-stone-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("grooming")}
            className={`py-2.5 min-h-[40px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
              activeTab === "grooming"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-amber-600" />
            <span>Grooming</span>
            {groomingLines.length > 1 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-extrabold">
                {groomingLines.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("retail")}
            className={`py-2.5 min-h-[40px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
              activeTab === "retail"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
            <span>สินค้าปลีก</span>
            {cart.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-extrabold">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("package")}
            className={`py-2.5 min-h-[40px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
              activeTab === "package"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Ticket className="w-3.5 h-3.5 text-amber-600" />
            <span>คูปอง/สมาชิก</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 max-w-xl mx-auto w-full space-y-4 flex-1">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
            {errorMessage}
          </div>
        )}

        {/* 1. กล่องเลือกวันที่ทำรายการ (รองรับการคีย์บิลย้อนหลัง) */}
        <section
          className={`rounded-2xl p-3 border transition-all ${
            orderDate === todayDate
              ? "bg-white border-stone-200/90 shadow-xs"
              : "bg-amber-500/10 border-amber-400 shadow-sm ring-1 ring-amber-400/50"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  orderDate === todayDate
                    ? "bg-stone-100 text-stone-600"
                    : "bg-amber-500 text-white font-bold animate-pulse shadow-xs"
                }`}
              >
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">
                    {orderDate === todayDate ? "วันที่ทำรายการ (วันนี้)" : "⚠️ กำลังบันทึกบิลย้อนหลัง"}
                  </span>
                  {orderDate !== todayDate && (
                    <span className="text-[10px] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                      ย้อนหลัง
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 truncate">
                  {orderDate === todayDate
                    ? "บิลจะถูกบันทึกเป็นยอดขายของวันนี้"
                    : `ยอดขายและบัญชีจะถูกบันทึกในวันที่ ${new Date(orderDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {orderDate !== todayDate && (
                <button
                  type="button"
                  onClick={() => setOrderDate(todayDate)}
                  className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-100/80 hover:bg-amber-200/80 px-2 py-1.5 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="รีเซ็ตกลับเป็นวันนี้"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">เป็นวันนี้</span>
                </button>
              )}
              <input
                type="date"
                value={orderDate}
                max={todayDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setOrderDate(e.target.value);
                  }
                }}
                className={`text-xs font-bold py-1.5 px-2.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus:ring-2 ${
                  orderDate === todayDate
                    ? "bg-stone-50 hover:bg-stone-100/80 border-stone-200 text-stone-700 focus:ring-amber-500/20"
                    : "bg-white border-amber-400 text-amber-900 shadow-xs focus:ring-amber-500/30"
                }`}
              />
            </div>
          </div>
        </section>

        {/* 2. Pet Selector (แสดงทั้ง Grooming และ Retail ที่ต้องการผูกลูกค้า) */}
        <PetSelector selectedPet={selectedPet} onSelectPet={handleSelectPrimaryPet} />

        {/* 3. MODE: Grooming Flow */}
        {activeTab === "grooming" && (
          <>
            {!selectedPet ? (
              <div className="bg-white rounded-2xl p-6 border border-stone-200/80 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
                  <Scissors className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-stone-800">กรุณาเลือกลูกค้าหรือสัตว์เลี้ยง</h4>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  ค้นหาชื่อลูกค้า, เบอร์โทร หรือชื่อน้องด้านบนเพื่อเริ่มคิดเงิน Grooming หรือกดปุ่ม “+ ลูกค้าใหม่”
                </p>
              </div>
            ) : (
              <>
                {/* แถบสัตว์เลี้ยงตัวอื่นๆ ในบ้านเดียวกัน (Multi-Pet Household Bar) */}
                {availableHouseholdPets.length > 0 && (
                  <section className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <span>🐾</span>
                        <span>สัตว์เลี้ยงอื่นๆ ในบ้านคุณ{selectedPet.customer?.name || "ลูกค้า"}:</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-medium">แตะเพื่อเพิ่มในบิลนี้</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableHouseholdPets.map((hp) => {
                        const isMem =
                          hp.active_membership?.status === "ใช้งานได้" ||
                          hp.active_membership?.status === "ใกล้หมดอายุ";
                        return (
                          <button
                            key={hp.id}
                            type="button"
                            onClick={() => handleAddHouseholdPet(hp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100/80 shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            <span>{hp.species === "แมว" ? "🐱" : "🐶"}</span>
                            <span>+ น้อง{hp.name}</span>
                            {isMem ? (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                                ลด 10%
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400">({hp.species})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* การ์ดบริการ Grooming ของสัตว์เลี้ยงแต่ละตัว */}
                {calculatedGroomingLines.map((line, index) => {
                  const isMember =
                    line.pet.active_membership?.status === "ใช้งานได้" ||
                    line.pet.active_membership?.status === "ใกล้หมดอายุ";

                  return (
                    <section
                      key={line.id}
                      className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm space-y-3.5"
                    >
                      {/* Pet Card Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{line.pet.species === "แมว" ? "🐱" : "🐶"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-extrabold text-stone-900">
                                น้อง{line.pet.name}
                              </h4>
                              {line.pet.active_membership?.status === "ใช้งานได้" && (
                                <span className="inline-flex items-center text-[10px] font-extrabold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                                  ⭐ Fur Fur Club (-10%)
                                </span>
                              )}
                              {line.pet.active_membership?.status === "ใกล้หมดอายุ" && (
                                <span className="inline-flex items-center text-[10px] font-extrabold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                                  ⏰ สมาชิกใกล้หมดอายุ (-10%)
                                </span>
                              )}
                              {line.pet.active_membership?.status === "หมดอายุ" && (
                                <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  ⚠️ สมาชิกหมดอายุ
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-stone-400">
                              {line.pet.breed ? `${line.pet.breed} • ` : ""}{line.pet.pet_code || ""}
                            </p>
                          </div>
                        </div>

                        {/* Remove Pet Button (if more than 1 pet in bill) */}
                        {groomingLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroomingLine(index)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl text-stone-400 hover:text-rose-600 active:bg-rose-50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95"
                            title="นำน้องออกจากบิล"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>นำออก</span>
                          </button>
                        )}
                      </div>

                      {/* รายการบริการของตัวนี้ */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>รายการบริการของน้อง{line.pet.name}</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() =>
                                handleUpdateLine(index, {
                                  serviceDesc: line.serviceDesc.trim()
                                    ? `${line.serviceDesc.trim()} ${chip}`
                                    : chip,
                                })
                              }
                              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-stone-100 active:bg-amber-100 text-stone-800 text-xs font-semibold hover:bg-amber-50 hover:text-amber-900 border border-stone-200 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={line.serviceDesc}
                          onChange={(e) => handleUpdateLine(index, { serviceDesc: e.target.value })}
                          rows={2}
                          autoCorrect="off"
                          placeholder={`พิมพ์รายละเอียดบริการน้อง${line.pet.name}...`}
                          className="w-full text-sm p-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/40"
                        />
                      </div>

                      {/* ราคา & ส่วนลดของตัวนี้ */}
                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <div>
                          <label className="text-xs font-semibold text-stone-600 block mb-1">
                            ราคาเต็มค่าบริการ (บาท)
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={line.priceInput}
                            onChange={(e) => handleUpdateLine(index, { priceInput: e.target.value })}
                            placeholder="0"
                            className="w-full text-base font-bold p-3 min-h-[48px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/40"
                          />
                        </div>

                        {/* ตัวเลือกส่วนลด */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5 text-amber-600" />
                              <span>ส่วนลดค่าบริการ</span>
                              {line.discountBaht > 0 && (
                                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                  -฿{line.discountBaht.toLocaleString()}
                                </span>
                              )}
                            </label>

                            <div className="inline-flex p-0.5 bg-stone-100 rounded-xl border border-stone-200/80 text-xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateLine(index, { discountMode: "percent" })}
                                className={`px-3 py-1.5 min-h-[34px] rounded-lg font-bold transition-all cursor-pointer ${
                                  line.discountMode === "percent"
                                    ? "bg-white text-stone-900 shadow-xs"
                                    : "text-stone-500 hover:text-stone-800"
                                }`}
                              >
                                % เปอร์เซ็นต์
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateLine(index, { discountMode: "baht" })}
                                className={`px-3 py-1.5 min-h-[34px] rounded-lg font-bold transition-all cursor-pointer ${
                                  line.discountMode === "baht"
                                    ? "bg-white text-stone-900 shadow-xs"
                                    : "text-stone-500 hover:text-stone-800"
                                }`}
                              >
                                ฿ บาท
                              </button>
                            </div>
                          </div>

                          {line.discountMode === "percent" ? (
                            <div className="grid grid-cols-4 gap-1.5">
                              {DISCOUNT_OPTIONS.map((opt) => {
                                const isMemberOpt = opt === "10%" && isMember;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleUpdateLine(index, { selectedDiscount: opt })}
                                    className={`py-2.5 px-1 min-h-[44px] rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 ${
                                      line.selectedDiscount === opt
                                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 active:bg-stone-200"
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {isMemberOpt && (
                                      <span
                                        className={`text-[9px] font-normal leading-tight ${
                                          line.selectedDiscount === opt ? "text-amber-100" : "text-amber-600"
                                        }`}
                                      >
                                        (สมาชิก)
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateLine(index, { bahtDiscountInput: "" })}
                                  className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                    !line.bahtDiscountInput || line.bahtDiscountInput === "0"
                                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 active:bg-stone-200"
                                  }`}
                                >
                                  ฿0 (ไม่ลด)
                                </button>
                                {[50, 100, 150, 200].map((amt) => {
                                  const isSelected = parseFloat(line.bahtDiscountInput) === amt;
                                  return (
                                    <button
                                      key={amt}
                                      type="button"
                                      onClick={() => handleUpdateLine(index, { bahtDiscountInput: amt.toString() })}
                                      className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                        isSelected
                                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                          : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 active:bg-stone-200"
                                      }`}
                                    >
                                      ลด ฿{amt}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  placeholder="ระบุจำนวนบาทเอง เช่น 80, 120..."
                                  value={line.bahtDiscountInput}
                                  onChange={(e) => handleUpdateLine(index, { bahtDiscountInput: e.target.value })}
                                  className="w-full text-xs font-bold p-3 pr-10 min-h-[44px] rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/40"
                                />
                                <span className="absolute right-3 top-3 text-xs font-bold text-stone-400">บาท</span>
                              </div>
                            </div>
                          )}

                          {/* สรุปยอดหลังลดของตัวนี้ */}
                          {line.numericPrice > 0 && (
                            <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/50 flex justify-between items-center text-xs">
                              <span className="text-amber-900 font-medium">
                                {line.discountBaht > 0
                                  ? `฿${line.numericPrice.toLocaleString()} - ส่วนลด ฿${line.discountBaht.toLocaleString()} (${line.finalDiscountText})`
                                  : `ราคาเต็ม ฿${line.numericPrice.toLocaleString()}`}
                              </span>
                              <span className="font-extrabold text-amber-950">
                                = ฿{line.netPrice.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}

                {/* กล่องสรุปยอดรวม Grooming หลายตัว (เมื่อมีสัตว์เลี้ยงมากกว่า 1 ตัว) */}
                {calculatedGroomingLines.length > 1 && (
                  <section className="bg-amber-500/10 rounded-2xl p-4 border border-amber-300 shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                      <span className="flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-amber-700" />
                        <span>รวมยอดบริการ Grooming ({calculatedGroomingLines.length} ตัว)</span>
                      </span>
                      <span className="text-base font-black text-amber-950">
                        ฿{totalGroomingNetPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-1 pt-1.5 border-t border-amber-200/70 text-xs text-amber-900">
                      {calculatedGroomingLines.map((l) => (
                        <div key={l.id} className="flex justify-between items-center">
                          <span>
                            น้อง{l.pet.name}: {l.serviceDesc.trim() || "Grooming"}
                          </span>
                          <span className="font-bold">฿{l.netPrice.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* คูปองเงินสดคงเหลือของลูกค้า/สัตว์เลี้ยง */}
                {activeCoupon && (
                  <section className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-700" />
                      <div>
                        <p className="text-xs font-bold text-amber-950">
                          คูปองคงเหลือ: ฿{activeCoupon.remaining_balance.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-amber-700">รหัส {activeCoupon.coupon_code}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseCoupon(!useCoupon)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        useCoupon 
                          ? "bg-amber-600 text-white shadow-sm" 
                          : "bg-white text-stone-600 border border-stone-300"
                      }`}
                    >
                      {useCoupon && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {useCoupon ? "ใช้คูปอง" : "ไม่ใช้คูปอง"}
                    </button>
                  </section>
                )}

                {/* ค่าคอมมิชชั่นช่าง Grooming (แสดงเฉพาะเมื่อเปิดใช้งานในเมนูตั้งค่าระบบ ⚙️) */}
                {settings.enableStaffCommission && (
                  <section className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-amber-600" />
                        <span>ค่าคอมมิชชั่นช่าง Grooming</span>
                      </label>
                      <span className="text-[10px] text-stone-400 font-medium">
                        หักออกจากกำไรร้าน • ค่าเริ่มต้น ฿0
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={staffCommission}
                        onChange={(e) => setStaffCommission(e.target.value)}
                        className="w-full text-sm font-bold p-3 pr-10 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/40"
                      />
                      <span className="absolute right-3 top-3 text-xs font-bold text-stone-400">บาท</span>
                    </div>
                  </section>
                )}

                {/* กล่องสินค้าปลีกพ่วงในบิล Grooming */}
                {cart.length > 0 ? (
                  <section className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-amber-700" />
                        <span className="text-xs font-bold text-amber-950">
                          สินค้าปลีกพ่วงในบิลนี้ ({cart.reduce((a, b) => a + b.quantity, 0)} ชิ้น)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("retail")}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-xs transition-colors cursor-pointer"
                      >
                        + เพิ่ม / แก้ไขสินค้า
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex justify-between items-center text-xs bg-white/80 p-2.5 rounded-xl border border-amber-100/70"
                        >
                          <div className="flex-1 pr-2">
                            <span className="font-bold text-stone-800 line-clamp-1">
                              {item.product.name}
                            </span>
                            <span className="text-[10px] text-stone-500">
                              {item.quantity} x ฿{item.product.selling_price.toLocaleString()} ({item.product.brand_group})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-stone-900">
                              ฿{(item.product.selling_price * item.quantity).toLocaleString()}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.product.id)}
                              className="text-stone-400 hover:text-rose-600 text-xs px-1 font-bold cursor-pointer"
                              title="ลบออกจากบิล"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-amber-200/60 flex justify-between items-center text-xs">
                      <span className="text-stone-600 font-medium">รวมยอดสินค้าปลีก</span>
                      <span className="font-black text-amber-950">฿{retailTotal.toLocaleString()}</span>
                    </div>
                  </section>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab("retail")}
                    className="w-full py-3 px-4 rounded-2xl border border-dashed border-stone-300 hover:border-amber-500 bg-white hover:bg-amber-50/40 text-stone-600 hover:text-amber-800 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-600" />
                    <span>+ เพิ่มสินค้าปลีกในบิลนี้ (แชมพู / ขนม / อุปกรณ์)</span>
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* 4. MODE: Retail Flow */}
        {activeTab === "retail" && (
          <div className="space-y-3">
            {hasGrooming && (
              <section className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-amber-950 block">
                      มีบริการ Grooming ในบิลนี้ (฿{totalGroomingNetPrice.toLocaleString()})
                    </span>
                    <span className="text-[11px] text-amber-800 line-clamp-1">
                      {calculatedGroomingLines
                        .filter((l) => l.numericPrice > 0 && l.serviceDesc.trim())
                        .map((l) => `[${l.pet.name}] ${l.serviceDesc}`)
                        .join(" • ") || "บริการ Grooming"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("grooming")}
                  className="px-2.5 py-1.5 bg-white text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-xs whitespace-nowrap ml-2 hover:bg-amber-100/50 cursor-pointer"
                >
                  ดู Grooming
                </button>
              </section>
            )}

            <RetailCatalog
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveFromCart={handleRemoveFromCart}
              onProductCreated={(newProduct) => {
                setProducts((prev) => [newProduct, ...prev]);
              }}
            />
          </div>
        )}

        {/* 5. MODE: Package & Membership Flow */}
        {activeTab === "package" && (
          <PackagePurchase
            selectedPet={selectedPet}
            orderDate={orderDate}
            onSuccess={async (orderNumber, note) => {
              setSuccessOrderNumber(orderNumber);
              setSuccessNote(note);
              if (selectedPet?.id) {
                const refreshed = await getPetById(selectedPet.id);
                if (refreshed) {
                  setSelectedPet(refreshed);
                }
              }

              // โหลดข้อมูลสลิปและเปิด ReceiptModal ทันที
              try {
                const detail = await getOrderDetail(orderNumber);
                if (detail) {
                  setCreatedOrderDetail(detail);
                  setIsReceiptOpen(true);
                }
              } catch (e) {
                console.error("Failed to load package order detail:", e);
              }
            }}
          />
        )}

        {/* 6. ช่องทางชำระเงิน */}
        {activeTab !== "package" && currentPayable > 0 && (
          <section className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-stone-700 block">
                วิธีชำระเงิน (฿{currentPayable.toLocaleString()})
              </label>
              {hasGrooming && hasRetail && (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                  บิลรวม Grooming + สินค้า
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "โอนเงิน/QR", label: "โอนเงิน / QR", icon: QrCode },
                { id: "เงินสด", label: "เงินสด", icon: Banknote },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl text-xs font-bold border gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === id
                      ? "bg-stone-800 text-white border-stone-800 shadow-sm"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* กล่องแสดงข้อมูลบัญชีธนาคาร & QR Code (สำหรับสแกนหรือโอนหน้าร้าน) */}
            {paymentMethod === "โอนเงิน/QR" && (
              <div className="p-3 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-stone-50 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 min-w-0">
                  {/* QR Thumbnail แตะเพื่อดูภาพใหญ่ */}
                  <button
                    type="button"
                    onClick={() => setShowQRPreview(true)}
                    className="relative w-12 h-12 bg-white rounded-lg p-1 border border-stone-200 shrink-0 shadow-xs hover:border-emerald-500 hover:ring-2 hover:ring-emerald-200 transition-all cursor-pointer group"
                    title="แตะเพื่อดู QR Code ขนาดใหญ่"
                  >
                    <img
                      src={STORE_PROFILE.bank.qrImageUrl}
                      alt="QR Payment"
                      className="w-full h-full object-contain rounded"
                    />
                    <div className="absolute inset-0 bg-stone-900/10 opacity-0 group-hover:opacity-100 rounded transition-opacity flex items-center justify-center">
                      <QrCode className="w-3.5 h-3.5 text-stone-900" />
                    </div>
                  </button>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-800">
                        🏦 {STORE_PROFILE.bank.bankName}
                      </span>
                    </div>
                    <p className="font-mono font-black text-xs text-stone-900 tracking-wide truncate">
                      {STORE_PROFILE.bank.accountNumber}
                    </p>
                    <p className="text-[10px] text-stone-500 truncate">
                      {STORE_PROFILE.bank.accountName} • {STORE_PROFILE.branch}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(STORE_PROFILE.bank.rawAccountNumber);
                      if (ok) {
                        setCopiedAccountQuick(true);
                        setTimeout(() => setCopiedAccountQuick(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-[10px] font-bold hover:bg-stone-50 active:scale-95 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    {copiedAccountQuick ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                        <span className="text-emerald-700">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-stone-500" />
                        <span>คัดลอกเลขบัญชี</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQRPreview(true)}
                    className="px-2 py-0.5 text-[10px] text-emerald-700 hover:text-emerald-800 font-bold hover:underline transition-colors text-center cursor-pointer"
                  >
                    ดูรูป QR สแกน
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      {activeTab !== "package" && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-stone-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg z-30">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              {hasGrooming && hasRetail && (
                <p className="text-[10px] text-stone-500 font-medium">
                  Grooming ฿{groomingRemainingPay.toLocaleString()} + สินค้า ฿{retailTotal.toLocaleString()}
                </p>
              )}
              {hasGrooming && !hasRetail && groomingLines.length > 1 && (
                <p className="text-[10px] text-stone-500 font-medium">
                  Grooming {groomingLines.length} ตัว (฿{totalGroomingNetPrice.toLocaleString()})
                </p>
              )}
              {hasGrooming && couponDeducted > 0 && (
                <p className="text-[11px] text-amber-700 font-medium">
                  หักคูปอง: -฿{couponDeducted.toLocaleString()}
                </p>
              )}
              <span className="text-xs text-stone-500 font-medium">ยอดชำระสุทธิ</span>
              <div className="text-2xl font-black text-stone-900 tracking-tight leading-none">
                ฿{currentPayable.toLocaleString()}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={
                isPending ||
                (!hasGrooming && !hasRetail) ||
                (hasGrooming && !selectedPet)
              }
              className="flex-1 max-w-[240px] h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-md shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <span>
                  {hasGrooming && hasRetail
                    ? `เปิดบิลรวม (฿${currentPayable.toLocaleString()})`
                    : hasGrooming
                    ? groomingLines.length > 1
                      ? `เปิดบิล Grooming ${groomingLines.length} ตัว (฿${currentPayable.toLocaleString()})`
                      : `เปิดบิล Grooming (฿${currentPayable.toLocaleString()})`
                    : `เปิดบิลขายปลีก (฿${currentPayable.toLocaleString()})`}
                </span>
              )}
            </button>
          </div>
        </footer>
      )}

      {/* Backup Success Modal (แสดงกรณีไม่ได้เปิด ReceiptModal) */}
      {successOrderNumber && !isReceiptOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[28px] sm:rounded-3xl max-w-sm w-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center shadow-2xl border-t sm:border border-stone-100 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-250">
            {/* iOS Sheet Grabber */}
            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">เปิดบิลชำระเงินสำเร็จ</h3>
              {successNote && <p className="text-xs text-stone-500 mt-1">{successNote}</p>}
              {orderDate !== todayDate && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>บันทึกเป็นบิลวันที่ {new Date(orderDate).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
              )}
            </div>
            <div className="bg-stone-50 rounded-2xl p-3 border border-stone-100">
              <span className="text-xs text-stone-400 block font-medium">เลขที่คำสั่งซื้อ</span>
              <span className="text-base font-extrabold text-stone-800 tracking-wider">
                {successOrderNumber}
              </span>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (successOrderNumber) {
                    const detail = await getOrderDetail(successOrderNumber);
                    if (detail) {
                      setCreatedOrderDetail(detail);
                      setIsReceiptOpen(true);
                    }
                  }
                }}
                className="flex-1 min-h-[46px] rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 active:bg-stone-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-amber-600" />
                <span>ดูสลิป / ส่ง LINE</span>
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                className="flex-1 min-h-[46px] bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                รับลูกค้ารายถัดไป
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal Component สำหรับหน้า POS */}
      <ReceiptModal
        order={createdOrderDetail}
        isOpen={isReceiptOpen}
        isNewOrder={true}
        closeButtonText="รับลูกค้ารายถัดไป"
        onNewOrderNext={handleResetForm}
        onClose={() => {
          setIsReceiptOpen(false);
          handleResetForm();
        }}
      />

      {/* QR Code Fullscreen Modal Preview */}
      {showQRPreview && (
        <div 
          className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowQRPreview(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-xs w-full p-5 text-center shadow-2xl border border-stone-100 space-y-3 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-stone-100">
              <span className="text-xs font-bold text-stone-800">
                สแกนจ่าย • {STORE_PROFILE.name}
              </span>
              <button
                type="button"
                onClick={() => setShowQRPreview(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-sm mx-auto w-56">
              <img
                src={STORE_PROFILE.bank.qrImageUrl}
                alt="QR Payment Fur Fur &"
                className="w-full h-auto object-contain rounded-xl"
              />
            </div>

            <div className="text-xs space-y-0.5 text-stone-600 font-sans">
              <p className="font-bold text-stone-900">{STORE_PROFILE.bank.bankName}</p>
              <p className="font-mono font-black text-sm text-stone-900 tracking-wider">
                {STORE_PROFILE.bank.accountNumber}
              </p>
              <p className="text-[11px] text-stone-500">{STORE_PROFILE.bank.accountName}</p>
              {currentPayable > 0 && (
                <p className="pt-1.5 text-emerald-700 font-black text-sm">
                  ยอดชำระ: ฿{currentPayable.toLocaleString()}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowQRPreview(false)}
              className="w-full min-h-[42px] bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedPOSPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <POSContent />
    </Suspense>
  );
}
