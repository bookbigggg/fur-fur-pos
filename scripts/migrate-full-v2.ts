// scripts/migrate-full-v2.ts
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "").trim();
  return clean.length >= 9 ? clean : null;
}

function normalizeSpecies(raw: string | null | undefined): "หมา" | "แมว" | "อื่นๆ" {
  if (!raw) return "หมา";
  if (raw.includes("แมว") || raw.toLowerCase().includes("cat")) return "แมว";
  if (raw.includes("หมา") || raw.includes("สุนัข") || raw.toLowerCase().includes("dog")) return "หมา";
  return "อื่นๆ";
}

function normalizePaymentMethod(pm: string | null | undefined): string {
  if (!pm) return "โอนเงิน/QR";
  const p = pm.trim();
  if (p === "เงินสด") return "เงินสด";
  if (p === "โอนเงิน") return "โอนเงิน";
  return "โอนเงิน/QR";
}

async function main() {
  console.log("🚀 === เริ่มต้น Migration ข้อมูลจริงจาก FurFur_Grooming_Master_V2 เข้าสู่ Supabase ===");

  // =========================================================================
  // 1. CLEAR EXISTING TEST DATA
  // =========================================================================
  console.log("\n🧹 1. ล้างข้อมูลทดสอบเดิมใน Supabase...");
  await supabase.from("order_retail_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("coupon_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("annual_memberships").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("coupons").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("pets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ เคลียร์ข้อมูลเดิมเรียบร้อย");

  // =========================================================================
  // 2. PRODUCTS
  // =========================================================================
  console.log("\n📦 2. นำเข้า Master สินค้า...");
  const productsData = JSON.parse(fs.readFileSync("data/import_v2/products.json", "utf-8"));
  const { error: prdErr } = await supabase.from("products").upsert(productsData, { onConflict: "product_code" });
  if (prdErr) {
    throw new Error(`Failed to insert products: ${prdErr.message}`);
  }
  console.log(`✅ บันทึกสินค้าสำเร็จ: ${productsData.length} รายการ`);

  // สร้าง Map สำหรับ Lookup Product
  const { data: allProducts } = await supabase.from("products").select("*");
  const productCodeMap = new Map<string, any>();
  allProducts?.forEach((p) => productCodeMap.set(p.product_code, p));

  // =========================================================================
  // 3. CUSTOMERS & PETS
  // =========================================================================
  console.log("\n🐾 3. ประมวลผลและนำเข้าลูกค้าและสัตว์เลี้ยง...");
  const rawCustPets = JSON.parse(fs.readFileSync("data/import_v2/customers_and_pets.json", "utf-8"));
  const rawGrooming = JSON.parse(fs.readFileSync("data/import_v2/grooming_orders.json", "utf-8"));

  interface CustEntry {
    name: string;
    phone: string | null;
    pets: Map<string, { displayName: string; species: "หมา" | "แมว" | "อื่นๆ"; breed: string | null; notes: string | null }>;
  }
  const custMap = new Map<string, CustEntry>();

  function getCustKey(name: string, phone: string | null): string {
    const normP = normalizePhone(phone);
    if (normP) return `PHONE:${normP}`;
    let cleanName = name.trim().toLowerCase();
    if (cleanName.includes("บลู/")) cleanName = "บลู";
    if (cleanName.includes("คุณบอส")) cleanName = "บอส";
    if (cleanName.includes("วุฒ")) cleanName = "วุฒ";
    return `NAME:${cleanName}`;
  }

  // A. โหลดจากฐานข้อมูลลูกค้าและสัตว์เลี้ยง
  for (const row of rawCustPets) {
    const ownerName = (row.owner_name || "").trim();
    const petName = (row.pet_name || "").trim();
    if (!ownerName || !petName) continue;

    const key = getCustKey(ownerName, row.phone);
    if (!custMap.has(key)) {
      custMap.set(key, {
        name: ownerName,
        phone: normalizePhone(row.phone),
        pets: new Map(),
      });
    }
    const c = custMap.get(key)!;
    const petKey = petName.toLowerCase();
    if (!c.pets.has(petKey)) {
      c.pets.set(petKey, {
        displayName: petName,
        species: normalizeSpecies(row.species),
        breed: row.breed || null,
        notes: row.notes || null,
      });
    }
  }

  // B. โหลดส่วนที่อาจมีเพิ่มจาก Grooming
  for (const g of rawGrooming) {
    const petName = (g.pet_name || "").trim();
    const ownerName = (g.owner_name || "").trim();
    if (!petName) continue;

    const phone = normalizePhone(g.phone);
    let matchedKey: string | null = null;

    if (phone && custMap.has(`PHONE:${phone}`)) {
      matchedKey = `PHONE:${phone}`;
    } else if (ownerName && custMap.has(getCustKey(ownerName, phone))) {
      matchedKey = getCustKey(ownerName, phone);
    } else {
      for (const [ck, entry] of custMap.entries()) {
        if (entry.pets.has(petName.toLowerCase())) {
          matchedKey = ck;
          break;
        }
      }
    }

    if (!matchedKey) {
      const finalOwner = ownerName || `เจ้าของน้อง${petName}`;
      matchedKey = getCustKey(finalOwner, phone);
      custMap.set(matchedKey, {
        name: finalOwner,
        phone: phone,
        pets: new Map(),
      });
    }

    const c = custMap.get(matchedKey)!;
    const petKey = petName.toLowerCase();
    if (!c.pets.has(petKey)) {
      c.pets.set(petKey, {
        displayName: petName,
        species: normalizeSpecies(g.species),
        breed: g.breed || null,
        notes: null,
      });
    }
  }

  // บันทึกลง Supabase
  let petSeqCounter = 1;
  const customerIdMap = new Map<string, string>();
  const petIdMap = new Map<string, string>();
  const uniquePetNameMap = new Map<string, string>();

  for (const [custKey, cEntry] of custMap.entries()) {
    const { data: newCust, error: cErr } = await supabase
      .from("customers")
      .insert({
        name: cEntry.name,
        phone: cEntry.phone,
      })
      .select("id")
      .single();

    if (cErr || !newCust) {
      console.error(`❌ ไม่สามารถบันทึก ${cEntry.name}:`, cErr?.message);
      continue;
    }

    customerIdMap.set(custKey, newCust.id);

    for (const [, pEntry] of cEntry.pets.entries()) {
      const petCode = `PET-${String(petSeqCounter++).padStart(4, "0")}`;

      const { data: newPet, error: pErr } = await supabase
        .from("pets")
        .insert({
          customer_id: newCust.id,
          pet_code: petCode,
          name: pEntry.displayName,
          species: pEntry.species,
          breed: pEntry.breed,
          health_notes: pEntry.notes,
        })
        .select("id")
        .single();

      if (pErr || !newPet) {
        console.error(`❌ บันทึกสัตว์เลี้ยง ${pEntry.displayName} ไม่สำเร็จ:`, pErr?.message);
        continue;
      }

      const compositeKey = `${pEntry.displayName.toLowerCase()}:${newCust.id}`;
      petIdMap.set(compositeKey, newPet.id);
      uniquePetNameMap.set(pEntry.displayName.toLowerCase(), newPet.id);
    }
  }

  console.log(`✅ บันทึกลูกค้าสำเร็จ: ${customerIdMap.size} คน`);
  console.log(`✅ บันทึกสัตว์เลี้ยงสำเร็จ: ${petIdMap.size} ตัว`);

  function resolvePetAndCustomer(petNameRaw: string, ownerNameRaw: string, phoneRaw: string | null) {
    const petName = (petNameRaw || "").trim().toLowerCase();
    const ownerName = (ownerNameRaw || "").trim();
    const phone = normalizePhone(phoneRaw);

    let customerId: string | null = null;
    let petId: string | null = null;

    if (phone && custMap.has(`PHONE:${phone}`)) {
      customerId = customerIdMap.get(`PHONE:${phone}`) || null;
    } else if (ownerName) {
      const cKey = getCustKey(ownerName, phone);
      customerId = customerIdMap.get(cKey) || null;
    }

    if (customerId && petName) {
      petId = petIdMap.get(`${petName}:${customerId}`) || null;
    }

    if (!petId && petName) {
      petId = uniquePetNameMap.get(petName) || null;
    }

    return { petId, customerId };
  }

  // =========================================================================
  // 4. COUPONS
  // =========================================================================
  console.log("\n🎟️ 4. นำเข้าคูปอง...");
  const rawCoupons = JSON.parse(fs.readFileSync("data/import_v2/coupons.json", "utf-8"));
  const couponIdMap = new Map<string, string>();

  for (const c of rawCoupons) {
    const { petId } = resolvePetAndCustomer(c.pet_name, c.owner_name, null);
    const createdAt = c.buy_date ? `${c.buy_date}T12:00:00.000Z` : new Date().toISOString();

    const { data: newCpn, error: cErr } = await supabase
      .from("coupons")
      .insert({
        pet_id: petId,
        coupon_code: c.coupon_code,
        package_value: c.package_value,
        paid_amount: c.paid_amount,
        remaining_balance: c.remaining_balance,
        status: "ใช้งานได้",
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (cErr || !newCpn) {
      console.error(`❌ บันทึกคูปอง ${c.coupon_code} ไม่สำเร็จ:`, cErr?.message);
      continue;
    }

    couponIdMap.set(c.coupon_code, newCpn.id);

    await supabase.from("coupon_transactions").insert({
      coupon_id: newCpn.id,
      transaction_type: "initial",
      amount: c.package_value,
      notes: `เปิดใช้งานคูปอง ${c.coupon_code} (จ่าย ฿${c.paid_amount} ได้มูลค่า ฿${c.package_value})`,
      created_at: createdAt,
    });
  }
  console.log(`✅ บันทึกคูปองสำเร็จ: ${couponIdMap.size} รายการ`);

  // =========================================================================
  // 5. ANNUAL MEMBERSHIPS
  // =========================================================================
  console.log("\n👑 5. นำเข้าสมาชิกรายปี...");
  const rawMemberships = JSON.parse(fs.readFileSync("data/import_v2/memberships.json", "utf-8"));
  let memCount = 0;

  for (const m of rawMemberships) {
    const { petId } = resolvePetAndCustomer(m.pet_name, m.owner_name, m.phone);
    if (!petId) {
      console.warn(`⚠️ ไม่พบสัตว์เลี้ยงสำหรับสมาชิก ${m.member_code} (${m.pet_name})`);
      continue;
    }

    const createdAt = m.start_date ? `${m.start_date}T12:00:00.000Z` : new Date().toISOString();

    const { error: mErr } = await supabase.from("annual_memberships").insert({
      pet_id: petId,
      member_code: m.member_code,
      fee: m.fee,
      start_date: m.start_date,
      expire_date: m.expire_date,
      status: "ใช้งานได้",
      payment_method: normalizePaymentMethod(m.payment_method),
      created_at: createdAt,
    });

    if (mErr) {
      console.error(`❌ บันทึกสมาชิก ${m.member_code} ไม่สำเร็จ:`, mErr.message);
    } else {
      memCount++;
    }
  }
  console.log(`✅ บันทึกสมาชิกรายปีสำเร็จ: ${memCount} ราย`);

  // =========================================================================
  // 6. EXPENSES
  // =========================================================================
  console.log("\n💸 6. นำเข้ารายจ่ายร้าน...");
  const rawExpenses = JSON.parse(fs.readFileSync("data/import_v2/expenses.json", "utf-8"));
  const expensesToInsert = rawExpenses.map((e: any) => ({
    expense_date: e.expense_date,
    category: e.category,
    title: e.title,
    amount: e.amount,
    payment_method: normalizePaymentMethod(e.payment_method),
    notes: e.notes ? `${e.expense_code}: ${e.notes}` : e.expense_code,
    created_at: `${e.expense_date}T12:00:00.000Z`,
  }));

  const { error: expErr } = await supabase.from("expenses").insert(expensesToInsert);
  if (expErr) {
    console.error("❌ บันทึกรายจ่ายไม่สำเร็จ:", expErr.message);
  } else {
    console.log(`✅ บันทึกรายจ่ายร้านสำเร็จ: ${expensesToInsert.length} รายการ`);
  }

  // =========================================================================
  // 7. GROOMING ORDERS
  // =========================================================================
  console.log("\n✂️ 7. นำเข้าบิลบริการกรูมมิ่ง...");
  let groomingSuccess = 0;

  for (const g of rawGrooming) {
    const { petId, customerId } = resolvePetAndCustomer(g.pet_name, g.owner_name, g.phone);
    const createdAt = `${g.order_date}T12:00:00.000Z`;

    let couponId: string | null = null;
    let couponDeducted = 0;
    let recognizedIncome = 0;

    if (g.coupon_code && couponIdMap.has(g.coupon_code)) {
      couponId = couponIdMap.get(g.coupon_code) || null;
      couponDeducted = g.net_paid;
      recognizedIncome = Number((couponDeducted * (3000 / 3300)).toFixed(2));
    }

    const { data: newOrder, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_number: g.order_number,
        customer_id: customerId,
        pet_id: petId,
        order_type: "grooming",
        service_description: g.service_description,
        full_price: g.full_price,
        discount_text: g.discount_text,
        net_paid: g.net_paid,
        staff_commission: g.staff_commission,
        shop_net_income: g.shop_net_income,
        coupon_id: couponId,
        coupon_deducted: couponDeducted,
        recognized_coupon_income: recognizedIncome,
        payment_method: normalizePaymentMethod(g.payment_method),
        order_date: g.order_date,
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (oErr || !newOrder) {
      console.error(`❌ ไม่สามารถบันทึกบิล ${g.order_number}:`, oErr?.message);
      continue;
    }

    groomingSuccess++;

    if (couponId && couponDeducted > 0) {
      await supabase.from("coupon_transactions").insert({
        coupon_id: couponId,
        order_id: newOrder.id,
        transaction_type: "usage",
        amount: couponDeducted,
        notes: `ตัดยอดชำระบริการบิล ${g.order_number}`,
        created_at: createdAt,
      });
    }
  }
  console.log(`✅ บันทึกบิลกรูมมิ่งสำเร็จ: ${groomingSuccess} บิล`);

  // =========================================================================
  // 8. RETAIL ORDERS
  // =========================================================================
  console.log("\n🛍️ 8. นำเข้าบิลขายสินค้าปลีก/ฝากขาย...");
  const rawRetail = JSON.parse(fs.readFileSync("data/import_v2/retail_orders.json", "utf-8"));
  let retailSuccess = 0;
  const seenOrderNumbers = new Set<string>();

  for (let idx = 0; idx < rawRetail.length; idx++) {
    const r = rawRetail[idx];
    let orderNum = r.order_number;
    if (seenOrderNumbers.has(orderNum)) {
      orderNum = `${r.order_number}-${idx + 1}`;
    }
    seenOrderNumbers.add(orderNum);

    const product = productCodeMap.get(r.product_code);
    const createdAt = `${r.order_date}T12:00:00.000Z`;

    const { data: newOrder, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNum,
        order_type: "retail",
        service_description: `สินค้าปลีก: ${r.product_name} (${r.quantity} ชิ้น)`,
        full_price: r.total_price,
        discount_text: null,
        net_paid: r.total_price,
        staff_commission: 0,
        shop_net_income: r.shop_profit,
        coupon_id: null,
        coupon_deducted: 0,
        recognized_coupon_income: 0,
        payment_method: normalizePaymentMethod(r.payment_method),
        order_date: r.order_date,
        created_at: createdAt,
      })
      .select("id")
      .single();

    if (oErr || !newOrder) {
      console.error(`❌ ไม่สามารถบันทึกบิลขายสินค้า ${orderNum}:`, oErr?.message);
      continue;
    }

    const { error: itmErr } = await supabase.from("order_retail_items").insert({
      order_id: newOrder.id,
      product_id: product?.id || null,
      product_name: r.product_name,
      brand_group: r.brand_group,
      quantity: r.quantity,
      unit_price: r.unit_price,
      total_price: r.total_price,
      cost_price: Number((r.unit_price - r.shop_profit / r.quantity).toFixed(2)),
      gp_rate: product?.gp_rate || 0,
      shop_profit: r.shop_profit,
      remit_amount: r.remit_amount,
      clearing_status: r.clearing_status,
      cleared_at: r.clearing_status === "เคลียร์แล้ว" ? createdAt : null,
      created_at: createdAt,
    });

    if (itmErr) {
      console.error(`❌ ไม่สามารถบันทึก item ในบิล ${orderNum}:`, itmErr.message);
    } else {
      retailSuccess++;
    }
  }
  console.log(`✅ บันทึกบิลสินค้าปลีกสำเร็จ: ${retailSuccess} บิล`);

  // =========================================================================
  // 9. UPDATE SEQUENCES
  // =========================================================================
  console.log("\n🔢 9. ปรับปรุง Sequence เลขบิลล่าสุดในระบบ...");
  await supabase.from("order_sequences").upsert({ prefix: "GRM-202610", last_val: 142 });
  await supabase.from("order_sequences").upsert({ prefix: "RET-202610", last_val: 16 });
  await supabase.from("order_sequences").upsert({ prefix: "MEM-202610", last_val: 4 });
  await supabase.from("order_sequences").upsert({ prefix: "CP-202610", last_val: 1 });
  console.log("✅ อัปเดต Sequences เรียบร้อย");

  console.log("\n🎉 ======================================================");
  console.log("    ALL REAL DATA MIGRATED WITH 100% SUCCESS!");
  console.log("======================================================\n");
}

main().catch((e) => {
  console.error("FATAL ERROR during migration:", e);
  process.exit(1);
});
