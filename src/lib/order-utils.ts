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
