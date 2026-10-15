import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { UserRole, UserSession } from "@/types/database";

export const POS_SESSION_COOKIE_NAME = "furfur_pos_session";

/**
 * ดึงและตรวจสอบความถูกต้องของ Session ปัจจุบัน
 * ตรวจสอบทั้ง POS Session Cookie (สำหรับ iPad Preset Login) และ Supabase Auth Session
 */
export async function getVerifiedSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();

  // 1. ตรวจสอบ POS Session Cookie (สำหรับ iPad Preset Login)
  const sessionCookie = cookieStore.get(POS_SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sessionCookie)) as UserSession;
      if (
        parsed &&
        parsed.id &&
        parsed.email &&
        (parsed.role === "owner" || parsed.role === "manager" || parsed.role === "staff")
      ) {
        return parsed;
      }
    } catch {
      // Invalid cookie format
    }
  }

  // 2. ตรวจสอบ Supabase Auth Session (กรณีล็อกอินด้วย Email & Password)
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user && user.email) {
      const role: UserRole =
        (user.user_metadata?.role as UserRole) ||
        (user.email.includes("staff") ? "staff" : "owner");
      const name: string =
        user.user_metadata?.display_name ||
        user.user_metadata?.name ||
        (role === "owner" ? "ฟาริ บุญเย็น (ผู้จัดการร้าน)" : "พนักงานหน้าร้าน");

      return {
        id: user.id,
        email: user.email,
        name,
        role,
      };
    }
  } catch {
    // Auth client lookup failed
  }

  return null;
}

/**
 * บังคับตรวจสอบสิทธิ์ผู้ใช้งานใน Server Actions
 * หากยังไม่ได้ล็อกอิน หรือมี Role ที่ไม่ได้รับอนุญาต จะ throw Error ทันที
 */
export async function requireSession(allowedRoles?: UserRole[]): Promise<UserSession> {
  const session = await getVerifiedSession();
  if (!session) {
    throw new Error("Unauthorized: กรุณาเข้าสู่ระบบก่อนทำรายการ");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw new Error("Forbidden: บัญชีของคุณไม่มีสิทธิ์ดำเนินการในส่วนนี้");
  }

  return session;
}

/**
 * Supabase Client สำหรับงาน Authentication โดยเฉพาะ (ใช้ Anon Key + Cookie Store)
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe fallback when setting cookies in Server Components
          }
        },
      },
    }
  );
}

/**
 * Supabase Client หลักสำหรับ Server Actions:
 * - หากมี SUPABASE_SERVICE_ROLE_KEY: ใช้ Service Role Key เพื่อ bypass RLS
 *   ทำให้การทำงานของ iPad Quick Preset Login หน้าร้านดึงและบันทึกข้อมูลได้ 100%
 * - หากไม่มี SUPABASE_SERVICE_ROLE_KEY: Fallback กลับไปใช้ Anon Client อัตโนมัติ
 */
export async function createClient(): Promise<SupabaseClient> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  if (serviceRoleKey) {
    return createSupabaseJsClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // Fallback: ใช้ SSR Client ด้วย Anon Key
  return (await createAuthClient()) as unknown as SupabaseClient;
}

/**
 * Admin Client โดยตรง (Alias ของ createClient)
 */
export async function createAdminClient(): Promise<SupabaseClient> {
  return createClient();
}
