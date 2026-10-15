// scripts/migrate-phase1.ts
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// 1. โหลด Environment Variables จาก .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_ANON_KEY ใน .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==============================================================================
// Helper Functions สำหรับประมวลผลข้อมูล
// ==============================================================================

// ฟังก์ชันแยก CSV พร้อมตัด UTF-8 BOM อัตโนมัติ
function parseCSV(content: string): Record<string, string>[] {
  // แก้ไข: ตัด UTF-8 BOM ที่อาจติดมาจาก Google Sheets
  const cleanContent = content.replace(/^\uFEFF/, "");
  
  const lines: string[] = [];
  let currentLine = "";
  let insideQuote = false;

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    if (char === '"') {
      insideQuote = !insideQuote;
      currentLine += char;
    } else if ((char === "\r" || char === "\n") && !insideQuote) {
      if (char === "\r" && cleanContent[i + 1] === "\n") i++;
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === "," && !insideQuote) {
      result.push(current.replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.replace(/^"|"$/g, "").trim());
  return result;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const clean = value.replace(/[฿,]/g, "").trim();
  if (clean === "-" || clean === "" || clean.toLowerCase() === "null") return 0;

  if (clean.includes("%")) {
    const num = parseFloat(clean.replace("%", "").trim());
    return isNaN(num) ? 0 : Number((num / 100).toFixed(4));
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parseGPRate(value: string | undefined): number {
  const num = parseNumber(value);
  if (num > 1) return Number((num / 100).toFixed(4));
  return Number(num.toFixed(4));
}

function normalizeSpecies(speciesRaw: string | undefined): "หมา" | "แมว" | "อื่นๆ" {
  if (!speciesRaw) return "หมา";
  const s = speciesRaw.trim();
  if (s.includes("แมว") || s.toLowerCase().includes("cat")) return "แมว";
  if (s.includes("หมา") || s.includes("สุนัข") || s.toLowerCase().includes("dog")) return "หมา";
  return "อื่นๆ";
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "").trim();
  return clean.length >= 9 ? clean : null;
}

// ==============================================================================
// Phase 1A: นำเข้า Master สินค้า (products.csv)
// ==============================================================================
async function migrateProducts() {
  console.log("\n📦 --- เริ่มต้นนำเข้า Master สินค้า (Phase 1A) ---");
  const filePath = path.resolve(process.cwd(), "data", "products.csv");

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ ไม่พบไฟล์ ${filePath} (ข้ามขั้นตอนนี้)`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(fileContent);

  console.log(`🔍 พบรายการสินค้าใน CSV ทั้งหมด: ${rows.length} รายการ`);

  const productsToUpsert = rows
    .map((row) => {
      const code = row["รหัสสินค้า"] || row["product_code"] || row["Code"];
      const name = row["ชื่อสินค้า/บริการ"] || row["ชื่อสินค้า"] || row["product_name"] || row["Name"];
      const brand = row["กลุ่ม/เจ้าของ"] || row["แบรนด์"] || row["brand_group"] || row["Brand"] || "Fur Fur";
      const sellingPrice = parseNumber(row["ราคาขาย"] || row["selling_price"] || row["Price"]);
      const costPrice = parseNumber(row["ต้นทุน/ชิ้น"] || row["ต้นทุน"] || row["cost_price"] || row["Cost"]);
      const gpRate = parseGPRate(row["% ส่วนแบ่งร้าน (GP)"] || row["GP"] || row["gp_rate"]);
      const remitAmount = parseNumber(row["ยอดเคลียร์จ่าย/คืนทุน"] || row["ยอดเคลียร์"] || row["remit_amount"]);

      if (!code || !name) return null;

      return {
        product_code: code,
        name: name,
        brand_group: brand,
        selling_price: sellingPrice,
        cost_price: costPrice,
        gp_rate: gpRate,
        remit_amount: remitAmount,
        is_active: true,
      };
    })
    .filter(Boolean);

  if (productsToUpsert.length === 0) {
    console.warn("⚠️ ไม่มีข้อมูลสินค้าที่สมบูรณ์สำหรับบันทึก");
    return;
  }

  const { error } = await supabase
    .from("products")
    .upsert(productsToUpsert, { onConflict: "product_code" });

  if (error) {
    console.error("❌ เกิดข้อผิดพลาดในการ Upsert สินค้า:", error.message);
  } else {
    console.log(`✅ นำเข้าสินค้าสำเร็จ: ${productsToUpsert.length} รายการ`);
  }
}

// ==============================================================================
// Phase 1B: สกัดและ Deduplicate ลูกค้า & สัตว์เลี้ยง (grooming.csv)
// ==============================================================================
interface CustomerAggregated {
  name: string;
  phone: string | null;
  pets: Map<string, { displayName: string; species: "หมา" | "แมว" | "อื่นๆ"; breed: string | null }>;
}

async function migrateCustomersAndPets() {
  console.log("\n🐾 --- เริ่มต้นสกัดลูกค้า & สัตว์เลี้ยง (Phase 1B) ---");
  const filePath = path.resolve(process.cwd(), "data", "grooming.csv");

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ ไม่พบไฟล์ ${filePath} (ข้ามขั้นตอนนี้)`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(fileContent);

  console.log(`🔍 พบประวัติการใช้บริการใน CSV ทั้งหมด: ${rows.length} แถว`);

  const customerMap = new Map<string, CustomerAggregated>();

  for (const row of rows) {
    const ownerName = (row["ชื่อเจ้าของ"] || row["ลูกค้า"] || row["customer_name"] || "").trim();
    const phoneRaw = row["เบอร์ติดต่อ"] || row["เบอร์โทร"] || row["phone"];
    const petName = (row["ชื่อสัตว์"] || row["ชื่อน้อง"] || row["pet_name"] || "").trim();
    const speciesRaw = row["ประเภทสัตว์"] || row["ประเภท"] || row["species"];
    const breedRaw = (row["สายพันธุ์"] || row["พันธุ์"] || row["breed"] || "").trim();

    if (!ownerName || !petName) continue;

    const normalizedPhone = normalizePhone(phoneRaw);
    const dedupeKey = normalizedPhone ? `PHONE:${normalizedPhone}` : `NAME:${ownerName.toLowerCase()}`;

    if (!customerMap.has(dedupeKey)) {
      customerMap.set(dedupeKey, {
        name: ownerName,
        phone: normalizedPhone,
        pets: new Map(),
      });
    }

    const customer = customerMap.get(dedupeKey)!;
    const petKey = petName.toLowerCase();
    
    // บันทึกชื่อดั้งเดิม (คงตัวพิมพ์ใหญ่/เล็กไว้)
    if (!customer.pets.has(petKey)) {
      customer.pets.set(petKey, {
        displayName: petName,
        species: normalizeSpecies(speciesRaw),
        breed: breedRaw || null,
      });
    }
  }

  console.log(`📊 รวมข้อมูลลูกค้าที่ไม่ซ้ำกันได้: ${customerMap.size} คน`);

  // แก้ไข: ดึงรหัส PET ล่าสุดจาก Database เพื่อป้องกันการสร้างรหัสชนกัน
  const { data: lastPet } = await supabase
    .from("pets")
    .select("pet_code")
    .order("pet_code", { ascending: false })
    .limit(1)
    .maybeSingle();

  let petSequence = 1;
  if (lastPet?.pet_code) {
    const match = lastPet.pet_code.match(/PET-(\d+)/);
    if (match) petSequence = parseInt(match[1], 10) + 1;
  }

  let totalCustomersSaved = 0;
  let totalPetsSaved = 0;

  for (const [, custData] of customerMap.entries()) {
    let customerId: string | null = null;

    if (custData.phone) {
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", custData.phone)
        .maybeSingle();
      if (existingCust) customerId = existingCust.id;
    } else {
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id")
        .eq("name", custData.name)
        .maybeSingle();
      if (existingCust) customerId = existingCust.id;
    }

    if (!customerId) {
      const { data: newCust, error: insertCustErr } = await supabase
        .from("customers")
        .insert({
          name: custData.name,
          phone: custData.phone,
        })
        .select("id")
        .single();

      if (insertCustErr || !newCust) {
        console.error(`❌ เพิ่มลูกค้า ${custData.name} ไม่สำเร็จ:`, insertCustErr?.message);
        continue;
      }
      customerId = newCust.id;
      totalCustomersSaved++;
    }

    for (const [, petData] of custData.pets.entries()) {
      const { data: existingPet } = await supabase
        .from("pets")
        .select("id")
        .eq("customer_id", customerId)
        .ilike("name", petData.displayName)
        .maybeSingle();

      if (!existingPet) {
        const petCode = `PET-${String(petSequence).padStart(4, "0")}`;
        const { error: insertPetErr } = await supabase.from("pets").insert({
          customer_id: customerId,
          pet_code: petCode,
          name: petData.displayName,
          species: petData.species,
          breed: petData.breed,
        });

        if (!insertPetErr) {
          petSequence++;
          totalPetsSaved++;
        } else {
          console.error(`❌ บันทึกสัตว์เลี้ยง ${petData.displayName} ไม่สำเร็จ:`, insertPetErr.message);
        }
      }
    }
  }

  console.log(`✅ บันทึกลูกค้าใหม่สำเร็จ: ${totalCustomersSaved} ราย`);
  console.log(`✅ บันทึกสัตว์เลี้ยงใหม่สำเร็จ: ${totalPetsSaved} ตัว`);
}

// ==============================================================================
// Main Runner
// ==============================================================================
async function main() {
  console.log("🚀 === เริ่มต้นการ Migrate ข้อมูลเข้าสู่ Supabase (Phase 1) ===");
  const startTime = Date.now();

  try {
    await migrateProducts();
    await migrateCustomersAndPets();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 เสร็จสิ้น Data Migration Phase 1 ทั้งหมดภายใน ${duration} วินาที\n`);
  } catch (err) {
    console.error("\n💥 เกิดข้อผิดพลาดร้ายแรงระหว่างการ Migration:", err);
    process.exit(1);
  }
}

main();
