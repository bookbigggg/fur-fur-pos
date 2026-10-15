"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Product, PaymentMethod } from "@/types/database";
import { getNextOrderNumber, getNextProductCode } from "@/lib/sequences";
import { calculateRetailItemProfit } from "@/lib/order-utils";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CreateRetailOrderInput {
  customerId?: string | null;
  petId?: string | null;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  orderDate?: string;
}

export interface RetailOrderResult {
  success: boolean;
  orderNumber?: string;
  totalAmount?: number;
  shopProfit?: number;
  remitTotal?: number;
  error?: string;
}

export interface CreateProductInput {
  product_code?: string | null;
  name: string;
  brand_group: string;
  selling_price: number;
  cost_price?: number;
  gp_rate?: number;
  remit_amount?: number;
  is_active?: boolean;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}



// 1. ดึงสินค้า Master ทั้งหมดที่เปิดใช้งาน
export async function getActiveProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("brand_group", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching active products:", error);
      return [];
    }
    return (data as unknown as Product[]) || [];
  } catch (err) {
    console.error("getActiveProducts Exception:", err);
    return [];
  }
}

// 2. ดึงสินค้า Master ทั้งหมด (รวมที่ปิดใช้งาน สำหรับหน้าจัดการสินค้า)
export async function getAllProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("brand_group", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching all products:", error);
      return [];
    }
    return (data as unknown as Product[]) || [];
  } catch (err) {
    console.error("getAllProducts Exception:", err);
    return [];
  }
}

// 3. ดึงรายชื่อแบรนด์ทั้งหมดจากฐานข้อมูลแบบไดนามิก
export async function getAllBrands(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("brand_group")
      .order("brand_group", { ascending: true });

    if (error || !data) return [];

    const brandsSet = new Set<string>();
    data.forEach((p: { brand_group: string | null }) => {
      if (p.brand_group && p.brand_group.trim()) {
        brandsSet.add(p.brand_group.trim());
      }
    });

    return Array.from(brandsSet).sort((a, b) => a.localeCompare(b, "th"));
  } catch (err) {
    console.error("getAllBrands Exception:", err);
    return [];
  }
}

// 4. เพิ่มสินค้าใหม่ (รองรับการเพิ่มสินค้าและแบรนด์ใหม่ได้ทันที)
export async function createProduct(
  input: CreateProductInput
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const supabase = await createClient();

    if (!input.name.trim()) {
      return { success: false, error: "กรุณาระบุชื่อสินค้า" };
    }
    if (!input.brand_group.trim()) {
      return { success: false, error: "กรุณาระบุแบรนด์สินค้า" };
    }
    if (input.selling_price < 0) {
      return { success: false, error: "ราคาขายต้องไม่ติดลบ" };
    }

    const sellingPrice = Number(input.selling_price);
    const costPrice = Number(input.cost_price) || 0;
    let gpRate = Number(input.gp_rate) || 0;
    let remitAmount = Number(input.remit_amount) || 0;

    // คำนวณค่า remit_amount และ gp_rate อัตโนมัติหากไม่ได้ระบุมาทั้งคู่
    if (remitAmount === 0 && gpRate > 0) {
      remitAmount = Number((sellingPrice * (1 - gpRate)).toFixed(2));
    } else if (remitAmount === 0 && costPrice > 0) {
      remitAmount = costPrice;
      gpRate = sellingPrice > 0 ? Number(((sellingPrice - costPrice) / sellingPrice).toFixed(4)) : 0;
    } else if (remitAmount > 0 && gpRate === 0 && sellingPrice > 0) {
      gpRate = Number(((sellingPrice - remitAmount) / sellingPrice).toFixed(4));
    }

    const productCode = input.product_code?.trim() || (await getNextProductCode(supabase));

    const payload = {
      product_code: productCode,
      name: input.name.trim(),
      brand_group: input.brand_group.trim(),
      selling_price: sellingPrice,
      cost_price: costPrice,
      gp_rate: gpRate,
      remit_amount: remitAmount,
      is_active: input.is_active ?? true,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/pos");
    revalidatePath("/settlement");

    return { success: true, data: data as unknown as Product };
  } catch (err: unknown) {
    console.error("createProduct Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเพิ่มสินค้า",
    };
  }
}

// 5. แก้ไขสินค้าเดิม
export async function updateProduct(
  input: UpdateProductInput
): Promise<{ success: boolean; data?: Product; error?: string }> {
  try {
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.brand_group !== undefined) updatePayload.brand_group = input.brand_group.trim();
    if (input.selling_price !== undefined) updatePayload.selling_price = Number(input.selling_price);
    if (input.cost_price !== undefined) updatePayload.cost_price = Number(input.cost_price);
    if (input.gp_rate !== undefined) updatePayload.gp_rate = Number(input.gp_rate);
    if (input.remit_amount !== undefined) updatePayload.remit_amount = Number(input.remit_amount);
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
    if (input.product_code !== undefined) updatePayload.product_code = input.product_code?.trim() || null;

    const { data, error } = await supabase
      .from("products")
      .update(updatePayload)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/pos");
    revalidatePath("/settlement");

    return { success: true, data: data as unknown as Product };
  } catch (err: unknown) {
    console.error("updateProduct Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการแก้ไขสินค้า",
    };
  }
}

// 6. เปิด/ปิดสถานะการจำหน่ายสินค้า
export async function toggleProductActive(
  productId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("products")
      .update({ is_active: isActive })
      .eq("id", productId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/pos");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปรับสถานะสินค้า",
    };
  }
}

// 7. สร้างบิลขายปลีก (RTL-YYYYMM-XXXX) โดยคำนวณ GP และ Remit อิงตาม DB เสมอ
export async function createRetailOrder(
  input: CreateRetailOrderInput
): Promise<RetailOrderResult> {
  try {
    const supabase = await createClient();

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "ไม่มีสินค้าในตะกร้า" };
    }

    let orderTotal = 0;
    let totalShopProfit = 0;
    let totalRemit = 0;

    const retailItemsToInsert = input.items.map(({ product, quantity }) => {
      // ใช้ฟังก์ชันคำนวณที่อิงจากข้อมูลจริงใน Database 100%
      const calc = calculateRetailItemProfit(product, quantity);

      orderTotal += calc.totalPrice;
      totalShopProfit += calc.shopProfit;
      totalRemit += calc.remitAmount;

      return {
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
        clearing_status: "รอเคลียร์" as const,
      };
    });

    orderTotal = Number(orderTotal.toFixed(2));
    totalShopProfit = Number(totalShopProfit.toFixed(2));
    totalRemit = Number(totalRemit.toFixed(2));

    // วันที่ตาม Timezone ไทย (Asia/Bangkok)
    const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const targetOrderDate = input.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(input.orderDate)
      ? input.orderDate
      : bangkokDate;

    const isBackdated = targetOrderDate !== bangkokDate;
    const targetCreatedAt = isBackdated
      ? `${targetOrderDate}T12:00:00+07:00`
      : new Date().toISOString();

    const orderNumber = await getNextOrderNumber(supabase, "retail");

    // บันทึกลงตาราง orders
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: input.customerId || null,
        pet_id: input.petId || null,
        order_type: "retail",
        service_description: `ขายปลีกสินค้า (${input.items.length} รายการ)`,
        full_price: orderTotal,
        discount_text: "0%",
        coupon_deducted: 0,
        recognized_coupon_income: 0,
        net_paid: orderTotal,
        staff_commission: 0,
        shop_net_income: totalShopProfit,
        payment_method: input.paymentMethod,
        order_date: targetOrderDate,
        created_at: targetCreatedAt,
      })
      .select("id")
      .single();

    if (orderError || !newOrder) {
      console.error("Order Insert Error:", orderError);
      return { success: false, error: orderError?.message || "ไม่สามารถเปิดบิลได้" };
    }

    // บันทึกลงตาราง order_retail_items
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
      // Rollback ลบบิลคำสั่งซื้อออก ป้องกัน Orphan Order
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return { success: false, error: `บันทึกรายการสินค้าไม่สำเร็จ: ${itemsError.message}` };
    }

    revalidatePath("/pos");
    revalidatePath("/orders");
    revalidatePath("/closing");
    revalidatePath("/settlement");
    revalidatePath("/expenses");

    return {
      success: true,
      orderNumber,
      totalAmount: orderTotal,
      shopProfit: totalShopProfit,
      remitTotal: totalRemit,
    };
  } catch (err: unknown) {
    console.error("Retail Checkout Exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกบิล",
    };
  }
}
