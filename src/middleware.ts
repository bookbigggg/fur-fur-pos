import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SESSION_COOKIE_NAME = "furfur_pos_session";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // 1. ยกเว้น Static Files และ Asset ต่างๆ ไม่ต้องผ่าน Auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return response;
  }

  // 2. ตรวจสอบ Supabase Auth Session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase auth check fallback
  }

  // 3. ตรวจสอบ POS Session Cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let cookieRole: string | null = null;

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sessionCookie));
      cookieRole = parsed.role || null;
    } catch {
      // Invalid cookie
    }
  }

  const isAuthenticated = Boolean(user || cookieRole);
  const userRole = (user?.user_metadata?.role as string) || cookieRole || "staff";

  // 4. กรณีผู้ใช้ยังไม่ได้ล็อกอิน
  if (!isAuthenticated) {
    if (pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // 5. กรณีผู้ใช้ล็อกอินแล้ว และพยายามเข้าหน้า /login
  if (isAuthenticated && pathname === "/login") {
    const posUrl = request.nextUrl.clone();
    posUrl.pathname = "/pos";
    return NextResponse.redirect(posUrl);
  }

  // 6. การควบคุมสิทธิ์ (RBAC): พนักงานทั่วไป (staff) ห้ามเข้าหน้างบ P&L (/expenses) และเคลียร์เงินคู่ค้า (/settlement)
  if (userRole === "staff") {
    if (pathname.startsWith("/expenses") || pathname.startsWith("/settlement")) {
      const deniedUrl = request.nextUrl.clone();
      deniedUrl.pathname = "/pos";
      deniedUrl.searchParams.set("denied", "1");
      return NextResponse.redirect(deniedUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
