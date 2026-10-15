"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient, getVerifiedSession, POS_SESSION_COOKIE_NAME } from "@/lib/supabase/server";
import { UserRole, UserSession } from "@/types/database";

const SESSION_COOKIE_NAME = POS_SESSION_COOKIE_NAME;

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: UserSession;
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบัน (Current Session)
 * ตรวจสอบทั้ง Supabase Auth Session และ POS Session Cookie
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  return getVerifiedSession();
}

/**
 * บันทึก Session Cookie สำหรับระบบ POS หน้าร้าน
 */
async function setSessionCookie(session: UserSession) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeURIComponent(JSON.stringify(session)), {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 วัน
  });
}

/**
 * เข้าสู่ระบบด้วย Email & Password ผ่าน Supabase Auth
 */
export async function signInWithEmail(email: string, pass: string): Promise<AuthResult> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !pass) {
      return { success: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" };
    }

    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error) {
      // ตรวจสอบข้อความ Error ภาษาไทยที่เข้าใจง่าย
      if (error.message.includes("Invalid login credentials")) {
        return { success: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
      }
      if (error.message.includes("Email not confirmed")) {
        // หากยังไม่ได้ยืนยันอีเมลใน Supabase Dashboard ให้จำแนก Role และสร้าง Session ให้ใช้งานหน้าร้านได้ทันที
        const role: UserRole = cleanEmail.includes("staff") ? "staff" : "owner";
        const session: UserSession = {
          id: `pos-${role}-${Date.now()}`,
          email: cleanEmail,
          name: role === "owner" ? "เจ้าของร้าน Fur Fur" : "พนักงานหน้าร้าน",
          role,
        };
        await setSessionCookie(session);
        revalidatePath("/", "layout");
        return { success: true, user: session };
      }
      return { success: false, error: error.message };
    }

    if (data.user) {
      const role: UserRole =
        (data.user.user_metadata?.role as UserRole) ||
        (cleanEmail.includes("staff") ? "staff" : "owner");
      const name: string =
        data.user.user_metadata?.display_name ||
        (role === "owner" ? "เจ้าของร้าน Fur Fur" : "พนักงานหน้าร้าน");

      const session: UserSession = {
        id: data.user.id,
        email: cleanEmail,
        name,
        role,
      };

      await setSessionCookie(session);
      revalidatePath("/", "layout");
      return { success: true, user: session };
    }

    return { success: false, error: "ไม่พบข้อมูลผู้ใช้" };
  } catch (err: unknown) {
    console.error("signInWithEmail error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
    };
  }
}

/**
 * Quick Preset Login สำหรับ iPad Terminal หน้าร้าน (เลือกสลับสิทธิ์ได้ทันที)
 */
export async function signInWithPreset(role: UserRole): Promise<AuthResult> {
  try {
    const isOwner = role === "owner" || role === "manager";
    const session: UserSession = {
      id: isOwner ? "pos-owner-001" : "pos-staff-001",
      email: isOwner ? "fari@furfurand.com" : "staff@furfurand.com",
      name: isOwner ? "ฟาริ บุญเย็น (ผู้จัดการร้าน)" : "พนักงานหน้าร้าน",
      role: isOwner ? "owner" : "staff",
    };

    await setSessionCookie(session);
    revalidatePath("/", "layout");
    return { success: true, user: session };
  } catch (err) {
    console.error("signInWithPreset error:", err);
    return { success: false, error: "ไม่สามารถเข้าสู่ระบบได้" };
  }
}

/**
 * ออกจากระบบ (Sign Out)
 */
export async function signOutUser() {
  try {
    const supabase = await createAuthClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore Supabase sign out error if network fails
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  revalidatePath("/", "layout");
  redirect("/login");
}
