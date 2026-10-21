"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Pet, Customer, Species, AnnualMembership, Coupon, CustomerWithPets, CustomerStatsKPI } from "@/types/database";
import { getNextPetCode } from "@/lib/sequences";

export interface PetSearchResult extends Pet {
  customer?: Customer;
}

interface RawPetSearchRow extends Omit<Pet, "active_membership"> {
  customer?: Customer;
  active_membership?: AnnualMembership[];
  active_coupons?: Coupon[];
}

// คำนวณสถานะสมาชิกตามวันหมดอายุจริง (Asia/Bangkok)
function evaluateMembership(memberships?: AnnualMembership[]): AnnualMembership | null {
  if (!memberships || memberships.length === 0) return null;

  // เรียงลำดับเอาข้อมูลที่วันหมดอายุล่าสุดเป็นหลัก
  const sorted = [...memberships].sort(
    (a, b) => new Date(b.expire_date).getTime() - new Date(a.expire_date).getTime()
  );
  const latest = sorted[0];
  if (!latest || !latest.expire_date) return null;

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const today = new Date(todayStr);
  const expireDate = new Date(latest.expire_date);

  const diffTime = expireDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let computedStatus: AnnualMembership["status"] = "ใช้งานได้";
  if (diffDays < 0) {
    computedStatus = "หมดอายุ";
  } else if (diffDays <= 30) {
    computedStatus = "ใกล้หมดอายุ";
  } else {
    computedStatus = "ใช้งานได้";
  }

  return {
    ...latest,
    status: computedStatus,
  };
}

export async function searchPetsAndCustomers(query: string): Promise<PetSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = await createClient();
  const cleanQuery = query.trim();

  const { data: matchedCustomers } = await supabase
    .from("customers")
    .select("id")
    .or(`phone.ilike.%${cleanQuery}%,name.ilike.%${cleanQuery}%`);

  const customerIds = matchedCustomers?.map((c: { id: string }) => c.id) || [];

  let petFilter = `name.ilike.%${cleanQuery}%,pet_code.ilike.%${cleanQuery}%`;
  if (customerIds.length > 0) {
    petFilter += `,customer_id.in.(${customerIds.join(",")})`;
  }

  const { data, error } = await supabase
    .from("pets")
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone,
        notes
      ),
      active_membership:annual_memberships (
        id,
        pet_id,
        member_code,
        fee,
        start_date,
        expire_date,
        status,
        payment_method
      ),
      active_coupons:coupons (
        id,
        pet_id,
        coupon_code,
        package_value,
        paid_amount,
        remaining_balance,
        status
      )
    `)
    .or(petFilter)
    .limit(10);

  if (error) {
    console.error("Search pets error:", error);
    return [];
  }

  return ((data as unknown as RawPetSearchRow[]) || []).map((item: RawPetSearchRow) => ({
    ...item,
    active_membership: evaluateMembership(item.active_membership),
    active_coupons: item.active_coupons?.filter((c: Coupon) => c.status === "ใช้งานได้" && c.remaining_balance > 0) || [],
  }));
}

export interface QuickCreatePetInput {
  customerName: string;
  customerPhone?: string;
  petName: string;
  species: Species;
  breed?: string;
  weightKg?: number | null;
}

export async function createQuickCustomerAndPet(
  input: QuickCreatePetInput
): Promise<{ success: boolean; pet?: PetSearchResult; error?: string }> {
  try {
    const supabase = await createClient();

    if (!input.customerName.trim() || !input.petName.trim()) {
      return { success: false, error: "กรุณากรอกชื่อลูกค้าและชื่อสัตว์เลี้ยง" };
    }

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .insert({
        name: input.customerName.trim(),
        phone: input.customerPhone?.trim() || null,
      })
      .select()
      .single();

    if (custError || !customer) {
      return { success: false, error: custError?.message || "ไม่สามารถเพิ่มข้อมูลลูกค้าได้" };
    }

    const petCode = await getNextPetCode(supabase);

    const { data: pet, error: petError } = await supabase
      .from("pets")
      .insert({
        customer_id: customer.id,
        pet_code: petCode,
        name: input.petName.trim(),
        species: input.species || "หมา",
        breed: input.breed?.trim() || null,
        weight_kg: input.weightKg || null,
      })
      .select()
      .single();

    if (petError || !pet) {
      return { success: false, error: petError?.message || "ไม่สามารถเพิ่มข้อมูลสัตว์เลี้ยงได้" };
    }

    const completePet: PetSearchResult = {
      ...pet,
      customer,
      active_membership: null,
      active_coupons: [],
    };

    return { success: true, pet: completePet };
  } catch (err: unknown) {
    console.error("Create customer error:", err);
    const errorMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return { success: false, error: errorMessage };
  }
}

export async function getPetById(petId: string): Promise<PetSearchResult | null> {
  if (!petId) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pets")
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone,
        notes
      ),
      active_membership:annual_memberships (
        id,
        pet_id,
        member_code,
        fee,
        start_date,
        expire_date,
        status,
        payment_method
      ),
      active_coupons:coupons (
        id,
        pet_id,
        coupon_code,
        package_value,
        paid_amount,
        remaining_balance,
        status
      )
    `)
    .eq("id", petId)
    .single();

  if (error || !data) {
    return null;
  }

  const raw = data as unknown as RawPetSearchRow;
  return {
    ...raw,
    active_membership: evaluateMembership(raw.active_membership),
    active_coupons: raw.active_coupons?.filter((c: Coupon) => c.status === "ใช้งานได้" && c.remaining_balance > 0) || [],
  };
}

export async function getPetsByCustomerId(customerId: string): Promise<PetSearchResult[]> {
  if (!customerId) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pets")
    .select(`
      *,
      customer:customers (
        id,
        name,
        phone,
        notes
      ),
      active_membership:annual_memberships (
        id,
        pet_id,
        member_code,
        fee,
        start_date,
        expire_date,
        status,
        payment_method
      ),
      active_coupons:coupons (
        id,
        pet_id,
        coupon_code,
        package_value,
        paid_amount,
        remaining_balance,
        status
      )
    `)
    .eq("customer_id", customerId)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  const rawList = data as unknown as RawPetSearchRow[];
  return rawList.map((raw) => ({
    ...raw,
    active_membership: evaluateMembership(raw.active_membership),
    active_coupons: raw.active_coupons?.filter((c: Coupon) => c.status === "ใช้งานได้" && c.remaining_balance > 0) || [],
  }));
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  notes?: string;
  petName?: string;
  species?: Species;
  breed?: string;
  weightKg?: number | null;
  healthNotes?: string;
}

export interface UpdateCustomerInput {
  name: string;
  phone?: string;
  notes?: string;
}

export interface CreatePetInput {
  customerId: string;
  name: string;
  species: Species;
  breed?: string;
  weightKg?: number | null;
  healthNotes?: string;
}

export interface UpdatePetInput {
  name: string;
  species: Species;
  breed?: string;
  weightKg?: number | null;
  healthNotes?: string;
}

export interface CustomerOrderHistory {
  id: string;
  order_number: string;
  order_date: string;
  order_type: string;
  service_description?: string | null;
  full_price: number;
  discount_text: string;
  net_paid: number;
  coupon_deducted: number;
  payment_method: string;
  status: string;
  pet?: {
    id: string;
    name: string;
    species: Species;
    breed?: string | null;
  } | null;
}

export async function getCustomerStats(): Promise<CustomerStatsKPI> {
  const supabase = await createClient();

  const [
    { count: totalCustomers },
    { count: totalPets },
    { data: memberships },
    { data: activeCoupons }
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("pets").select("*", { count: "exact", head: true }),
    supabase.from("annual_memberships").select("expire_date, status"),
    supabase.from("coupons").select("remaining_balance, status").eq("status", "ใช้งานได้").gt("remaining_balance", 0),
  ]);

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const activeMembershipsCount = (memberships || []).filter((m) => {
    return m.expire_date >= todayStr;
  }).length;

  const validCoupons = activeCoupons || [];
  const activeCouponsCount = validCoupons.length;
  const totalCouponBalance = validCoupons.reduce((sum, c) => sum + Number(c.remaining_balance || 0), 0);

  return {
    totalCustomers: totalCustomers || 0,
    totalPets: totalPets || 0,
    activeMembershipsCount,
    activeCouponsCount,
    totalCouponBalance,
  };
}

export async function getCustomersList(options?: {
  search?: string;
  filter?: string;
  sort?: string;
}): Promise<{ success: boolean; customers: CustomerWithPets[]; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. ดึงข้อมูลลูกค้าพร้อมสัตว์เลี้ยง, สมาชิก, คูปอง
    const { data: rawCustomers, error } = await supabase
      .from("customers")
      .select(`
        *,
        pets:pets (
          *,
          active_membership:annual_memberships (
            id,
            pet_id,
            member_code,
            fee,
            start_date,
            expire_date,
            status,
            payment_method
          ),
          active_coupons:coupons (
            id,
            pet_id,
            coupon_code,
            package_value,
            paid_amount,
            remaining_balance,
            status
          )
        )
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("getCustomersList error:", error);
      return { success: false, customers: [], error: error.message };
    }

    // 2. ดึงสรุปประวัติบิลเพื่อคำนวณจำนวนครั้งและวันที่มาล่าสุด
    const { data: orderStats } = await supabase
      .from("orders")
      .select("customer_id, order_date")
      .order("order_date", { ascending: false });

    const orderCountMap: Record<string, number> = {};
    const lastOrderDateMap: Record<string, string> = {};

    (orderStats || []).forEach((ord: { customer_id?: string | null; order_date?: string | null }) => {
      if (!ord.customer_id) return;
      orderCountMap[ord.customer_id] = (orderCountMap[ord.customer_id] || 0) + 1;
      if (!lastOrderDateMap[ord.customer_id] && ord.order_date) {
        lastOrderDateMap[ord.customer_id] = ord.order_date;
      }
    });

    // 3. Process customers and pets
    let processed: CustomerWithPets[] = (rawCustomers || []).map((c: any) => {
      const rawPets = (c.pets || []) as RawPetSearchRow[];
      const pets: Pet[] = rawPets.map((p) => ({
        ...p,
        active_membership: evaluateMembership(p.active_membership),
        active_coupons: p.active_coupons?.filter((cp: Coupon) => cp.status === "ใช้งานได้" && cp.remaining_balance > 0) || [],
      }));

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        created_at: c.created_at,
        updated_at: c.updated_at,
        pets,
        orderCount: orderCountMap[c.id] || 0,
        lastOrderDate: lastOrderDateMap[c.id] || null,
      };
    });

    // 4. Filter
    if (options?.filter) {
      const f = options.filter;
      if (f === "membership") {
        processed = processed.filter((c) =>
          c.pets.some((p) => p.active_membership && p.active_membership.status !== "หมดอายุ")
        );
      } else if (f === "coupon") {
        processed = processed.filter((c) =>
          c.pets.some((p) => p.active_coupons && p.active_coupons.length > 0)
        );
      } else if (f === "dog") {
        processed = processed.filter((c) =>
          c.pets.some((p) => p.species === "หมา")
        );
      } else if (f === "cat") {
        processed = processed.filter((c) =>
          c.pets.some((p) => p.species === "แมว")
        );
      }
    }

    // 5. Search
    if (options?.search && options.search.trim().length > 0) {
      const q = options.search.trim().toLowerCase();
      const qDigits = q.replace(/[^0-9]/g, "");

      processed = processed.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(q);
        const phoneMatch = qDigits.length >= 2 && c.phone && c.phone.replace(/[^0-9]/g, "").includes(qDigits);
        const noteMatch = c.notes?.toLowerCase().includes(q);
        const petMatch = c.pets.some((p) => 
          p.name?.toLowerCase().includes(q) ||
          p.breed?.toLowerCase().includes(q) ||
          p.pet_code?.toLowerCase().includes(q)
        );
        return Boolean(nameMatch || phoneMatch || noteMatch || petMatch);
      });
    }

    // 6. Sort
    const sort = options?.sort || "name";
    if (sort === "name") {
      processed.sort((a, b) => a.name.localeCompare(b.name, "th"));
    } else if (sort === "latest") {
      processed.sort((a, b) => {
        const dateA = a.lastOrderDate || a.created_at;
        const dateB = b.lastOrderDate || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    } else if (sort === "pets_count") {
      processed.sort((a, b) => b.pets.length - a.pets.length);
    }

    return { success: true, customers: processed };
  } catch (err: unknown) {
    console.error("getCustomersList exception:", err);
    return { success: false, customers: [], error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function getCustomerDetail(customerId: string): Promise<{
  success: boolean;
  customer?: CustomerWithPets;
  orders?: CustomerOrderHistory[];
  error?: string;
}> {
  try {
    if (!customerId) return { success: false, error: "ไม่พบรหัสลูกค้า" };
    const supabase = await createClient();

    const { data: customerData, error: custErr } = await supabase
      .from("customers")
      .select(`
        *,
        pets:pets (
          *,
          active_membership:annual_memberships (
            id,
            pet_id,
            member_code,
            fee,
            start_date,
            expire_date,
            status,
            payment_method
          ),
          active_coupons:coupons (
            id,
            pet_id,
            coupon_code,
            package_value,
            paid_amount,
            remaining_balance,
            status
          )
        )
      `)
      .eq("id", customerId)
      .single();

    if (custErr || !customerData) {
      return { success: false, error: "ไม่พบข้อมูลลูกค้า" };
    }

    const rawPets = (customerData.pets || []) as RawPetSearchRow[];
    const pets: Pet[] = rawPets.map((p) => ({
      ...p,
      active_membership: evaluateMembership(p.active_membership),
      active_coupons: p.active_coupons?.filter((cp: Coupon) => cp.status === "ใช้งานได้" && cp.remaining_balance > 0) || [],
    }));

    const { data: orderData } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        order_date,
        order_type,
        service_description,
        full_price,
        discount_text,
        net_paid,
        coupon_deducted,
        payment_method,
        status,
        pet:pets (
          id,
          name,
          species,
          breed
        )
      `)
      .eq("customer_id", customerId)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    const orders: CustomerOrderHistory[] = ((orderData as unknown as CustomerOrderHistory[]) || []);

    const customer: CustomerWithPets = {
      id: customerData.id,
      name: customerData.name,
      phone: customerData.phone,
      notes: customerData.notes,
      created_at: customerData.created_at,
      updated_at: customerData.updated_at,
      pets,
      orderCount: orders.length,
      lastOrderDate: orders[0]?.order_date || null,
    };

    return { success: true, customer, orders };
  } catch (err: unknown) {
    console.error("getCustomerDetail error:", err);
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function createCustomer(input: CreateCustomerInput): Promise<{
  success: boolean;
  customerId?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    if (!input.name.trim()) {
      return { success: false, error: "กรุณาระบุชื่อลูกค้า" };
    }

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select()
      .single();

    if (custErr || !customer) {
      return { success: false, error: custErr?.message || "ไม่สามารถเพิ่มลูกค้าได้" };
    }

    if (input.petName?.trim()) {
      const petCode = await getNextPetCode(supabase);
      await supabase.from("pets").insert({
        customer_id: customer.id,
        pet_code: petCode,
        name: input.petName.trim(),
        species: input.species || "หมา",
        breed: input.breed?.trim() || null,
        weight_kg: input.weightKg || null,
        health_notes: input.healthNotes?.trim() || null,
      });
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true, customerId: customer.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!customerId) return { success: false, error: "ไม่พบรหัสลูกค้า" };
    if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อลูกค้า" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function addPet(input: CreatePetInput): Promise<{
  success: boolean;
  petId?: string;
  error?: string;
}> {
  try {
    if (!input.customerId) return { success: false, error: "ไม่พบรหัสลูกค้า" };
    if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อสัตว์เลี้ยง" };

    const supabase = await createClient();
    const petCode = await getNextPetCode(supabase);

    const { data: pet, error } = await supabase
      .from("pets")
      .insert({
        customer_id: input.customerId,
        pet_code: petCode,
        name: input.name.trim(),
        species: input.species || "หมา",
        breed: input.breed?.trim() || null,
        weight_kg: input.weightKg || null,
        health_notes: input.healthNotes?.trim() || null,
      })
      .select()
      .single();

    if (error || !pet) {
      return { success: false, error: error?.message || "ไม่สามารถเพิ่มสัตว์เลี้ยงได้" };
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true, petId: pet.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function updatePet(
  petId: string,
  input: UpdatePetInput
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!petId) return { success: false, error: "ไม่พบรหัสสัตว์เลี้ยง" };
    if (!input.name.trim()) return { success: false, error: "กรุณาระบุชื่อสัตว์เลี้ยง" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("pets")
      .update({
        name: input.name.trim(),
        species: input.species || "หมา",
        breed: input.breed?.trim() || null,
        weight_kg: input.weightKg || null,
        health_notes: input.healthNotes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", petId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function deletePet(petId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!petId) return { success: false, error: "ไม่พบรหัสสัตว์เลี้ยง" };
    const supabase = await createClient();

    // ตรวจสอบว่ามีบิลประวัติคำสั่งซื้อหรือไม่
    const { count: orderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("pet_id", petId);

    if (orderCount && orderCount > 0) {
      return {
        success: false,
        error: `ไม่สามารถลบสัตว์เลี้ยงนี้ได้ เนื่องจากมีประวัติบิลคำสั่งซื้อจำนวน ${orderCount} รายการในระบบ`,
      };
    }

    const { error } = await supabase.from("pets").delete().eq("id", petId);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

export async function deleteCustomer(customerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!customerId) return { success: false, error: "ไม่พบรหัสลูกค้า" };
    const supabase = await createClient();

    // ตรวจสอบว่ามีบิลประวัติคำสั่งซื้อหรือไม่
    const { count: orderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId);

    if (orderCount && orderCount > 0) {
      return {
        success: false,
        error: `ไม่สามารถลบลูกค้ารายนี้ได้ เนื่องจากมีประวัติบิลคำสั่งซื้อจำนวน ${orderCount} รายการในระบบ`,
      };
    }

    // ลบสัตว์เลี้ยงของลูกค้าก่อน
    await supabase.from("pets").delete().eq("customer_id", customerId);

    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/pos");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" };
  }
}

