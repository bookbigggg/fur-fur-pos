"use server";

import { createClient } from "@/lib/supabase/server";
import { Pet, Customer, Species, AnnualMembership, Coupon } from "@/types/database";
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

