"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PaymentMethod } from "@/types/database";
import { getNextOrderNumber } from "@/lib/sequences";
import { CartItem } from "@/app/actions/retail";
import { calculateRetailItemProfit } from "@/lib/order-utils";

export interface GroomingPetItemInput {
  petId: string;
  petName: string;
  species?: string;
  breed?: string | null;
  serviceDescription: string;
  fullPrice: number;
  discountText: string;
  discountBaht: number;
  netPrice: number;
}

export interface CheckoutInput {
  customerId?: string | null;
  petId?: string | null;
  serviceDescription: string;
  fullPrice: number;
  discountText: string;
  couponId?: string | null;
  couponDeducted: number;
  netPaid: number;
  staffCommission: number;
  paymentMethod: PaymentMethod;
  retailItems?: CartItem[];
  orderDate?: string;
  groomingItems?: GroomingPetItemInput[];
}

export async function createGroomingOrder(input: CheckoutInput) {
  try {
    const supabase = await createClient();

    if (!input.serviceDescription.trim()) {
      return { success: false, error: "กรุณาระบุรายละเอียดบริการ" };
    }
    if (input.fullPrice <= 0) {
      return { success: false, error: "ราคาค่าบริการต้องมากกว่า 0 บาท" };
    }

    // 1. ตรวจสอบสิทธิ์และความพร้อมของคูปอง (หากมีการใช้คูปอง)
    let couponRecord: {
      id: string;
      remaining_balance: number;
      package_value: number;
      paid_amount: number;
      status: string;
    } | null = null;

    let recognizedCouponIncome = 0;

    if (input.couponDeducted > 0) {
      if (!input.couponId) {
        return { success: false, error: "ไม่พบข้อมูลคูปองที่ต้องการตัดยอด" };
      }

      const { data: coupon, error: couponFetchError } = await supabase
        .from("coupons")
        .select("id, remaining_balance, package_value, paid_amount, status")
        .eq("id", input.couponId)
        .maybeSingle();

      if (couponFetchError || !coupon) {
        return { success: false, error: "ไม่พบข้อมูลคูปองในระบบ กรุณาลองใหม่อีกครั้ง" };
      }

      if (coupon.status !== "ใช้งานได้" || coupon.remaining_balance <= 0) {
        return { success: false, error: "คูปองนี้ถูกใช้หมดแล้วหรือยกเลิกการใช้งาน" };
      }

      if (coupon.remaining_balance < input.couponDeducted) {
        return {
          success: false,
          error: `ยอดเงินคงเหลือในคูปองไม่เพียงพอ (คงเหลือ ฿${coupon.remaining_balance.toLocaleString()} บาท)`,
        };
      }

      couponRecord = coupon;

      // คำนวณการรับรู้รายได้คูปองตามสัดส่วนเงินสดจริงที่ลูกค้าชำระมา (TFRS 15 Proportional Allocation: ทศนิยม 2 ตำแหน่ง)
      const ratio = coupon.package_value > 0 ? coupon.paid_amount / coupon.package_value : 1;
      recognizedCouponIncome = Number((input.couponDeducted * ratio).toFixed(2));
    }

    // 2. คำนวณสินค้าปลีก (ถ้ามีการพ่วงสินค้าปลีกในบิลกรูมมิ่ง)
    let totalRetailPrice = 0;
    let totalRetailShopProfit = 0;
    let totalRetailRemit = 0;
    const retailItemsToInsert: Array<{
      product_id?: string | null;
      product_name: string;
      brand_group: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      cost_price: number;
      gp_rate: number;
      shop_profit: number;
      remit_amount: number;
      clearing_status: "รอเคลียร์";
    }> = [];

    if (input.retailItems && input.retailItems.length > 0) {
      for (const item of input.retailItems) {
        const product = item.product;
        const quantity = item.quantity;
        const calc = calculateRetailItemProfit(product, quantity);

        totalRetailPrice += calc.totalPrice;
        totalRetailShopProfit += calc.shopProfit;
        totalRetailRemit += calc.remitAmount;

        retailItemsToInsert.push({
          product_id: product.id,
          product_name: product.name,
          brand_group: product.brand_group,
          quantity,
          unit_price: calc.unitPrice,
          total_price: calc.totalPrice,
          cost_price: calc.costPrice,
          gp_rate: calc.gpRate,
          shop_profit: calc.shopProfit,
          remit_amount: calc.remitAmount,
          clearing_status: "รอเคลียร์",
        });
      }

      totalRetailPrice = Number(totalRetailPrice.toFixed(2));
      totalRetailShopProfit = Number(totalRetailShopProfit.toFixed(2));
      totalRetailRemit = Number(totalRetailRemit.toFixed(2));
    }

    // คำนวณยอดเงินรวมและรายได้ของร้าน (True Operating Income)
    const groomingCashPaid = Math.max(0, input.netPaid - totalRetailPrice);
    const combinedFullPrice = Number((input.fullPrice + totalRetailPrice).toFixed(2));
    let baseServiceDesc = input.serviceDescription.trim();
    if (input.groomingItems && input.groomingItems.length > 1) {
      baseServiceDesc = input.groomingItems
        .map((item) => `[${item.petName}] ${item.serviceDescription.trim() || "Grooming"} ฿${item.netPrice.toLocaleString()}`)
        .join(" • ");
    }

    const combinedServiceDesc =
      retailItemsToInsert.length > 0
        ? `${baseServiceDesc} + สินค้าปลีก (${retailItemsToInsert.length} รายการ)`
        : baseServiceDesc;

    // รายได้แท้จริงของร้าน = (เงินสดกรูมมิ่ง + คูปองกรูมมิ่งที่รับรู้ตามเกณฑ์) + กำไร GP สินค้าปลีก
    const finalShopNetIncome = Number(
      (groomingCashPaid + recognizedCouponIncome + totalRetailShopProfit).toFixed(2)
    );

    // 3. สร้าง Running Number เลขบิล: GRM-YYYYMM-XXXX (Atomic Sequence)
    const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const targetOrderDate = input.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
      ? input.orderDate
      : bangkokDate;

    // หากบันทึกบิลย้อนหลัง ให้กำหนด created_at เที่ยงวันเวลาไทย (05:00 UTC) เพื่อให้ระบบรายงานและบิลแสดงผลตามวันนั้น
    const isBackdated = targetOrderDate !== bangkokDate;
    const targetCreatedAt = isBackdated
      ? `${targetOrderDate}T12:00:00+07:00`
      : new Date().toISOString();

    const orderNumber = await getNextOrderNumber(supabase, "grooming");

    // 4. บันทึกคำสั่งซื้อลงตาราง orders
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId || null,
        pet_id: input.petId || null,
        order_type: "grooming",
        service_description: combinedServiceDesc,
        full_price: combinedFullPrice,
        discount_text: input.discountText,
        coupon_id: input.couponDeducted > 0 ? input.couponId : null,
        coupon_deducted: input.couponDeducted,
        recognized_coupon_income: recognizedCouponIncome,
        net_paid: input.netPaid,
        staff_commission: input.staffCommission,
        shop_net_income: finalShopNetIncome,
        payment_method: input.paymentMethod,
        order_date: targetOrderDate,
        created_at: targetCreatedAt,
      })
      .select("id")
      .single();

    if (insertError || !newOrder) {
      console.error("Order Insert Error:", insertError);
      return { success: false, error: insertError?.message || "ไม่สามารถเปิดบิลได้" };
    }

    // 5. บันทึกลงตาราง order_retail_items (ถ้ามีสินค้าปลีกพ่วงในบิล)
    if (retailItemsToInsert.length > 0) {
      const itemsPayload = retailItemsToInsert.map((item) => ({
        ...item,
        order_id: newOrder.id,
        created_at: targetCreatedAt,
      }));

      const { error: itemsError } = await supabase
        .from("order_retail_items")
        .insert(itemsPayload);

      if (itemsError) {
        console.error("Retail Items Insert Error:", itemsError);
        // Rollback ลบบิลคำสั่งซื้อออก
        await supabase.from("orders").delete().eq("id", newOrder.id);
        return { success: false, error: `บันทึกรายการสินค้าปลีกไม่สำเร็จ: ${itemsError.message}` };
      }
    }

    // 6. ตัดยอดคูปองในตาราง coupons และอัปเดตสถานะ
    if (couponRecord && input.couponDeducted > 0) {
      const newRemaining = Number(Math.max(0, couponRecord.remaining_balance - input.couponDeducted).toFixed(2));
      const newStatus = newRemaining === 0 ? "ใช้หมดแล้ว" : "ใช้งานได้";

      const { error: couponUpdateError } = await supabase
        .from("coupons")
        .update({
          remaining_balance: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", couponRecord.id);

      if (couponUpdateError) {
        console.error("Coupon Update Error:", couponUpdateError);
        // Rollback ลบรายการสินค้าปลีกและบิลคำสั่งซื้อออก
        await supabase.from("order_retail_items").delete().eq("order_id", newOrder.id);
        await supabase.from("orders").delete().eq("id", newOrder.id);
        return {
          success: false,
          error: `ตัดยอดคูปองไม่สำเร็จ ระบบได้ทำการยกเลิกบิลแล้ว: ${couponUpdateError.message}`,
        };
      }

      // บันทึก Log การตัดยอดคูปองลง coupon_transactions
      try {
        await supabase.from("coupon_transactions").insert({
          coupon_id: couponRecord.id,
          transaction_type: "deduct",
          amount: input.couponDeducted,
          notes: `ตัดยอดคูปองใช้บริการบิล ${orderNumber}`,
        });
      } catch (tErr) {
        console.warn("Could not insert coupon_transactions deduct log:", tErr);
      }
    }

    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/closing");
    revalidatePath("/expenses");
    revalidatePath("/settlement");

    return {
      success: true,
      orderNumber,
      retailTotal: totalRetailPrice,
      shopProfit: finalShopNetIncome,
      remitTotal: totalRetailRemit,
    };
  } catch (err: unknown) {
    console.error("Checkout Exception:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกบิล" 
    };
  }
}
