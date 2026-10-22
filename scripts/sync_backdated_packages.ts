import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🚀 เริ่มต้นสร้างบิลคำสั่งซื้อย้อนหลังสำหรับคูปองและสมาชิก...");

  // 1. ตรวจสอบ/สร้างข้อมูลลูกค้า คุณบอส
  let { data: bossCust } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", "0920929888")
    .maybeSingle();

  if (!bossCust) {
    const { data: createdBoss, error: bErr } = await supabase
      .from("customers")
      .insert({
        name: "คุณบอส",
        phone: "0920929888",
        notes: "เจ้าของหมูหยอง (สมาชิก MEM-001)",
      })
      .select("id")
      .single();

    if (bErr || !createdBoss) {
      throw new Error(`ไม่สามารถสร้างข้อมูลลูกค้าคุณบอสได้: ${bErr?.message}`);
    }
    bossCust = createdBoss;
    console.log("✅ สร้างข้อมูลลูกค้า คุณบอส เรียบร้อย:", bossCust.id);
  }

  // อัปเดต หมูหยอง ให้ผูกกับคุณบอส
  const { data: mooYong } = await supabase
    .from("pets")
    .select("id")
    .eq("name", "หมูหยอง")
    .single();

  if (mooYong && bossCust) {
    await supabase.from("pets").update({ customer_id: bossCust.id }).eq("id", mooYong.id);
    console.log("✅ ผูก หมูหยอง เข้ากับ คุณบอส เรียบร้อย");
  }

  // 2. อัปเดต บราวนี่ ให้ผูกกับ พี่ยะ
  const { data: yaCust } = await supabase
    .from("customers")
    .select("id")
    .eq("name", "พี่ยะ")
    .single();

  const { data: brownie } = await supabase
    .from("pets")
    .select("id")
    .eq("name", "บราวนี่")
    .single();

  if (brownie && yaCust) {
    await supabase.from("pets").update({ customer_id: yaCust.id }).eq("id", brownie.id);
    console.log("✅ ผูก บราวนี่ เข้ากับ พี่ยะ เรียบร้อย");
  }

  // 3. ดึงข้อมูลสมาชิกทั้ง 4 ราย
  const { data: mems, error: mErr } = await supabase
    .from("annual_memberships")
    .select("*, pets(id, name, customer_id)")
    .order("member_code");

  if (mErr || !mems) {
    throw new Error(`ดึงข้อมูลสมาชิกไม่สำเร็จ: ${mErr?.message}`);
  }

  const membershipOrders = [
    {
      order_number: "MEM-202610-0001",
      member_code: "MEM-001",
      date: "2026-10-03",
      payment_method: "โอนเงิน",
    },
    {
      order_number: "MEM-202610-0002",
      member_code: "MEM-002",
      date: "2026-10-04",
      payment_method: "โอนเงิน/QR",
    },
    {
      order_number: "MEM-202610-0003",
      member_code: "MEM-003",
      date: "2026-10-04",
      payment_method: "โอนเงิน",
    },
    {
      order_number: "MEM-202610-0004",
      member_code: "MEM-004",
      date: "2026-10-12",
      payment_method: "โอนเงิน",
    },
  ];

  for (const mPlan of membershipOrders) {
    const mem = mems.find((item) => item.member_code === mPlan.member_code);
    if (!mem) continue;

    const petId = mem.pet_id;
    const custId = mem.pets?.customer_id;

    // ตรวจสอบว่ามีบิลเลขนี้อยู่แล้วหรือไม่
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", mPlan.order_number)
      .maybeSingle();

    if (existing) {
      console.log(`ℹ️ บิล ${mPlan.order_number} มีอยู่ในระบบแล้ว ข้าม...`);
      continue;
    }

    const { error: insErr } = await supabase.from("orders").insert({
      order_number: mPlan.order_number,
      customer_id: custId,
      pet_id: petId,
      order_type: "membership",
      service_description: `สมัครสมาชิกรายปี 299 (${mPlan.member_code})`,
      full_price: 299,
      discount_text: "0%",
      coupon_deducted: 0,
      recognized_coupon_income: 0,
      net_paid: 299,
      staff_commission: 0,
      shop_net_income: 299,
      payment_method: mPlan.payment_method,
      order_date: mPlan.date,
      created_at: `${mPlan.date}T12:00:00+07:00`,
    });

    if (insErr) {
      console.error(`❌ สร้างบิล ${mPlan.order_number} ไม่สำเร็จ:`, insErr.message);
    } else {
      console.log(`✅ สร้างบิล ${mPlan.order_number} สำเร็จ (฿299)`);
    }
  }

  // 4. บันทึกบิลย้อนหลังสำหรับคูปอง CP-001 (นิโกะ)
  const { data: cpn } = await supabase
    .from("coupons")
    .select("*, pets(id, name, customer_id)")
    .eq("coupon_code", "CP-001")
    .single();

  if (cpn) {
    const cpnOrderNumber = "CPN-202609-0001";
    const { data: existingCpnOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", cpnOrderNumber)
      .maybeSingle();

    if (!existingCpnOrder) {
      const { error: cpnOrderErr } = await supabase.from("orders").insert({
        order_number: cpnOrderNumber,
        customer_id: cpn.pets?.customer_id,
        pet_id: cpn.pet_id,
        order_type: "coupon",
        coupon_id: cpn.id,
        service_description: `ซื้อแพ็กเกจคูปอง (CP-001) จ่าย ฿3,000 เครดิต ฿3,300`,
        full_price: 3300,
        discount_text: "0%",
        coupon_deducted: 0,
        recognized_coupon_income: 0,
        net_paid: 3000,
        staff_commission: 0,
        shop_net_income: 3000,
        payment_method: "โอนเงิน",
        order_date: "2026-09-16",
        created_at: "2026-09-16T12:00:00+07:00",
      });

      if (cpnOrderErr) {
        console.error(`❌ สร้างบิล ${cpnOrderNumber} ไม่สำเร็จ:`, cpnOrderErr.message);
      } else {
        console.log(`✅ สร้างบิลคูปอง ${cpnOrderNumber} สำเร็จ (฿3,000)`);
      }
    } else {
      console.log(`ℹ️ บิล ${cpnOrderNumber} มีอยู่ในระบบแล้ว`);
    }
  }

  // 5. ปรับปรุง Sequence เลขบิล
  await supabase.from("order_sequences").upsert({ prefix: "MEM-202610", last_val: 4 });
  await supabase.from("order_sequences").upsert({ prefix: "CPN-202609", last_val: 1 });
  console.log("✅ อัปเดต Sequences ล่าสุดเรียบร้อย");

  console.log("\n🎉 สร้างบิลคำสั่งซื้อย้อนหลังเรียบร้อย 100%!");
}

main().catch(console.error);
