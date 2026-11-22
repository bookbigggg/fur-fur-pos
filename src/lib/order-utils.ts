import { OrderStatus, Product } from "@/types/database";

/**
 * ฟังก์ชันตรวจสอบว่าบิลยังใช้งานอยู่ (Active) หรือถูกยกเลิก (Voided)
 * รองรับทั้งคอลัมน์ status และ fallback service_description / discount_text
 */
export function isOrderActive(order: {
  status?: OrderStatus | string | null;
  service_description?: string | null;
  discount_text?: string | null;
}): boolean {
  if (order.status === "voided" || order.status === "ยกเลิก") return false;
  if (order.service_description?.startsWith("[VOID]")) return false;
  if (order.discount_text?.includes("[VOID]")) return false;
  return true;
}

/**
 * ฟังก์ชันคำนวณกำไร GP และยอดโอนคืนคู่ค้าตามข้อมูลจริงในฐานข้อมูล (Dynamic DB-driven Calculation)
 * ปราศจากการ Hardcode ชื่อแบรนด์ 100%
 */
export function calculateRetailItemProfit(
  product: Product,
  quantity: number
): {
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
  gpRate: number;
  shopProfit: number;
  remitAmount: number;
} {
  const unitPrice = Number(product.selling_price) || 0;
  const totalPrice = Number((unitPrice * quantity).toFixed(2));
  const costPrice = Number(product.cost_price) || 0;

  let remitAmount = 0;
  let shopProfit = 0;
  let gpRate = Number(product.gp_rate) || 0;

  // 1. ถ้ามี remit_amount ระบุในสินค้า (เช่น สินค้าฝากขาย หรือ สินค้าที่กำหนดราคาโอนคืนคู่ค้า/คืนทุนคงที่)
  if (product.remit_amount !== undefined && product.remit_amount !== null && Number(product.remit_amount) > 0) {
    remitAmount = Number((Number(product.remit_amount) * quantity).toFixed(2));
    shopProfit = Number((totalPrice - remitAmount).toFixed(2));
    gpRate = totalPrice > 0 ? Number((shopProfit / totalPrice).toFixed(4)) : gpRate;
  } 
  // 2. ถ้ากำหนด gp_rate ไว้ชัดเจน (เช่น GP 25% หรือ 30%)
  else if (gpRate > 0) {
    shopProfit = Number((totalPrice * gpRate).toFixed(2));
    remitAmount = Number((totalPrice - shopProfit).toFixed(2));
  } 
  // 3. ถ้ากำหนด cost_price (สินค้าของร้านเอง คืนทุนตามราคาทุนจริง)
  else if (costPrice > 0) {
    remitAmount = Number((costPrice * quantity).toFixed(2));
    shopProfit = Number((totalPrice - remitAmount).toFixed(2));
    gpRate = totalPrice > 0 ? Number((shopProfit / totalPrice).toFixed(4)) : 0;
  } 
  // 4. กรณีไม่มีการกำหนด (เช่น สินค้าไม่มีกำไร/คืนทุนเต็มจำนวน)
  else {
    remitAmount = totalPrice;
    shopProfit = 0;
    gpRate = 0;
  }

  return {
    unitPrice,
    totalPrice,
    costPrice,
    gpRate,
    shopProfit,
    remitAmount,
  };
}

/**
 * ตรวจสอบว่าเป็นชื่อลูกค้าชั่วคราว/Walk-in ที่ไม่ควรนำมาคิดในรายชื่อติดตามลูกค้า (Retention/Upsell)
 */
export function isAnonymousCustomerName(name?: string | null): boolean {
  const normalized = (name || "").trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "walk in" ||
    normalized === "walk-in" ||
    normalized === "ลูกค้าทั่วไป"
  );
}

/**
 * ตรวจสอบว่าข้อมูลลูกค้ายังไม่สมบูรณ์ (ชื่อชั่วคราว, ไม่มีเบอร์โทร, หรือยังไม่มีสัตว์เลี้ยง)
 */
export function isCustomerIncomplete(customer: {
  name?: string | null;
  phone?: string | null;
  pets?: Array<unknown> | null;
}): boolean {
  const missingName = isAnonymousCustomerName(customer.name);
  const missingPhone = !(customer.phone || "").trim();
  const missingPets = !customer.pets || customer.pets.length === 0;
  return missingName || missingPhone || missingPets;
}

/**
 * คืนค่าวันที่ปัจจุบันใน Timezone ไทย (YYYY-MM-DD)
 */
export function getBangkokTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

/**
 * คำนวณจำนวนวันระหว่างวันที่ 2 วันในรูปแบบ YYYY-MM-DD (later - earlier)
 */
export function diffDaysBetweenDates(laterDateStr: string, earlierDateStr: string): number {
  const [y1, m1, d1] = laterDateStr.split("-").map(Number);
  const [y2, m2, d2] = earlierDateStr.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const ms1 = Date.UTC(y1, m1 - 1, d1);
  const ms2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((ms1 - ms2) / (1000 * 60 * 60 * 24));
}

/**
 * แยกรายได้ตามมาตรฐาน TFRS 15 สำหรับ 1 บิล (ใช้ร่วมกันระหว่าง P&L รายเดือนและแนวโน้มหลายเดือน)
 */
export function computeOrderRevenueParts(
  ord: {
    order_type?: string | null;
    net_paid?: number | string | null;
    shop_net_income?: number | string | null;
    recognized_coupon_income?: number | string | null;
    coupon_deducted?: number | string | null;
  },
  retailData?: { totalSales: number; shopProfit: number }
): {
  groomingCashSales: number;
  groomingCouponRecognized: number;
  retailGpProfit: number;
  membershipIncome: number;
  couponSales: number;
} {
  const netPaid = Number(ord.net_paid) || 0;
  const shopNetIncome = Number(ord.shop_net_income) || 0;
  const recognizedCoupon = Number(ord.recognized_coupon_income) || 0;
  const retailSalesInThisOrder = retailData?.totalSales || 0;
  const retailProfitInThisOrder = retailData?.shopProfit || 0;

  let groomingCashSales = 0;
  let groomingCouponRecognized = 0;
  let retailGpProfit = 0;
  let membershipIncome = 0;
  let couponSales = 0;

  switch (ord.order_type) {
    case "grooming": {
      groomingCashSales = Math.max(0, netPaid - retailSalesInThisOrder);
      if (recognizedCoupon > 0) {
        groomingCouponRecognized = recognizedCoupon;
      } else if (Number(ord.coupon_deducted) > 0) {
        groomingCouponRecognized = Number((Number(ord.coupon_deducted) * (3000 / 3300)).toFixed(2));
      }
      if (retailProfitInThisOrder > 0) {
        retailGpProfit = retailProfitInThisOrder;
      }
      break;
    }
    case "retail":
      retailGpProfit = retailProfitInThisOrder > 0 ? retailProfitInThisOrder : shopNetIncome;
      break;
    case "membership":
      membershipIncome = netPaid;
      break;
    case "coupon":
      couponSales = netPaid;
      break;
    default:
      groomingCashSales = netPaid;
      break;
  }

  return {
    groomingCashSales,
    groomingCouponRecognized,
    retailGpProfit,
    membershipIncome,
    couponSales,
  };
}
