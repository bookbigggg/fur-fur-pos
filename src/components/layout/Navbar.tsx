"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  X, 
  ShoppingBag, 
  ClipboardList, 
  Lock, 
  Wallet, 
  BarChart3, 
  Scissors, 
  RefreshCw,
  ChevronRight,
  LogOut,
  Crown,
  UserCheck,
  ShieldAlert,
  Settings,
  Ticket,
  Users
} from "lucide-react";
import { getCurrentSession, signOutUser } from "@/app/actions/auth";
import { UserSession } from "@/types/database";
import { useStoreSettings } from "@/lib/settings";
import SettingsModal from "@/components/settings/SettingsModal";

interface NavbarProps {
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const NAV_ITEMS = [
  {
    href: "/pos",
    label: "คิดเงินหน้าร้าน",
    desc: "รับบริการ Grooming, ขายสินค้าปลีก, สมาชิก & คูปอง",
    icon: ShoppingBag,
  },
  {
    href: "/customers",
    label: "ลูกค้า & สัตว์เลี้ยง",
    desc: "ฐานข้อมูลลูกค้า, สัตว์เลี้ยง, ประวัติบริการ และสมาชิก",
    icon: Users,
  },
  {
    href: "/orders",
    label: "ประวัติบิล & สลิป",
    desc: "ตรวจสอบบิลย้อนหลัง, สลิปดิจิทัลส่ง LINE",
    icon: ClipboardList,
  },
  {
    href: "/closing",
    label: "ปิดกะ & นับเงินสด",
    desc: "กระทบยอดเงินสดในเก๊ะ, บันทึกปิดกะประจำวัน",
    icon: Lock,
  },
  {
    href: "/settlement",
    label: "เคลียร์เงินคู่ค้า",
    desc: "ตัดรอบโอนเงินสินค้าฝากขาย, ใบสรุปยอด PDF",
    icon: Wallet,
  },
  {
    href: "/coupons",
    label: "แพ็กเกจ & สมาชิก",
    desc: "สรุปยอดคูปองเงินสด และสมาชิกรายปี 299",
    icon: Ticket,
  },
  {
    href: "/expenses",
    label: "กำไร-ขาดทุน",
    desc: "สรุปผลประกอบการและบันทึกค่าใช้จ่ายร้าน",
    icon: BarChart3,
  },
];

export default function Navbar({ subtitle, onRefresh, isRefreshing }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const { settings } = useStoreSettings();
  const pathname = usePathname();

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/closing" && !settings.enableDailyClosing) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    getCurrentSession().then(setSession);
  }, []);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Determine page title/subtitle
  const getPageInfo = () => {
    switch (pathname) {
      case "/pos":
        return { title: subtitle || "คิดเงินหน้าร้าน" };
      case "/orders":
        return { title: subtitle || "ประวัติบิล & สลิป" };
      case "/closing":
        return { title: subtitle || "ปิดกะ & นับเงินสด" };
      case "/settlement":
        return { title: subtitle || "เคลียร์เงินคู่ค้า" };
      case "/coupons":
        return { title: subtitle || "แพ็กเกจ & สมาชิก" };
      case "/expenses":
        return { title: subtitle || "กำไร-ขาดทุน" };
      default:
        return { title: subtitle || "คิดเงินหน้าร้าน" };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <>
      <header className="bg-white border-b border-stone-200 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Left - Eyebrow Brand + Prominent Page Title */}
          <Link href="/pos" className="flex items-center gap-2.5 group min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold border border-amber-200/60 group-hover:bg-amber-500/20 transition-colors shrink-0">
              <Scissors className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-700 tracking-wider uppercase leading-none">FUR FUR &</p>
              <h1 className="text-sm font-black text-stone-900 leading-tight mt-0.5 truncate">{pageInfo.title}</h1>
            </div>
          </Link>

          {/* Action Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {session && (
              <div className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                session.role === "owner" || session.role === "manager"
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "bg-stone-100 text-stone-700 border-stone-200"
              }`}>
                {session.role === "owner" || session.role === "manager" ? (
                  <Crown className="w-3 h-3 text-amber-600" />
                ) : (
                  <UserCheck className="w-3 h-3 text-stone-600" />
                )}
                <span>{session.role === "owner" ? "เจ้าของร้าน" : "พนักงาน"}</span>
              </div>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="w-10 h-10 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            )}

            {/* Menu Trigger Button */}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-800 font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Menu className="w-4 h-4 text-amber-600" />
              <span>เมนู</span>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Drawer & Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-[320px] bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div>
              <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                    <Scissors className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-stone-900 leading-tight">Fur Fur &</h3>
                    <p className="text-[10px] text-stone-400">เฟอ เฟอ แอนด์ • ระบบจัดการหน้าร้าน POS</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                  title="ปิดเมนู"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Profile Card */}
              {session && (
                <div className="mx-3 mt-3 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      session.role === "owner" || session.role === "manager"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-200 text-stone-800"
                    }`}>
                      {session.role === "owner" || session.role === "manager" ? (
                        <Crown className="w-4 h-4 text-amber-700" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-stone-700" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-900 truncate">
                        {session.name}
                      </p>
                      <p className="text-[10px] text-stone-500 truncate">
                        {session.email}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ml-1 ${
                    session.role === "owner" || session.role === "manager"
                      ? "bg-amber-100/80 text-amber-900 border-amber-300"
                      : "bg-stone-200/70 text-stone-700 border-stone-300"
                  }`}>
                    {session.role === "owner" ? "Owner" : session.role === "manager" ? "Manager" : "Staff"}
                  </span>
                </div>
              )}

              {authError && (
                <div className="mx-3 mt-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-xl flex items-center gap-1.5 font-medium animate-in fade-in">
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="p-3 space-y-1.5">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const isRestrictedForStaff =
                    session?.role === "staff" &&
                    (item.href === "/expenses" || item.href === "/settlement");

                  if (isRestrictedForStaff) {
                    return (
                      <div
                        key={item.href}
                        onClick={() => {
                          setAuthError("เฉพาะเจ้าของร้านหรือผู้จัดการเท่านั้นที่มีสิทธิ์เข้าถึงหน้านี้");
                          setTimeout(() => setAuthError(null), 4000);
                        }}
                        className="flex items-start gap-3 p-3 rounded-2xl border border-stone-100 bg-stone-50/50 opacity-60 cursor-not-allowed text-stone-400 select-none transition-all"
                      >
                        <div className="w-8 h-8 rounded-xl bg-stone-200/60 text-stone-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-stone-500">
                              {item.label}
                            </span>
                            <span className="text-[9px] font-bold text-stone-400 bg-stone-200/60 px-1.5 py-0.5 rounded">
                              เฉพาะ ผจก.
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-400 mt-0.5 leading-snug line-clamp-1">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-start gap-3 p-3 rounded-2xl transition-all border ${
                        isActive
                          ? "bg-amber-50 border-amber-300/80 text-amber-950 shadow-sm"
                          : "border-transparent hover:bg-stone-50 hover:border-stone-200/70 text-stone-700"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isActive ? "bg-amber-600 text-white shadow-sm" : "bg-stone-100 text-stone-600"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold leading-tight ${isActive ? "text-amber-950" : "text-stone-900"}`}>
                            {item.label}
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "text-amber-600" : "text-stone-300"}`} />
                        </div>
                        <p className="text-[10px] text-stone-500 mt-0.5 leading-snug line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 pb-[max(1rem,calc(0.75rem+env(safe-area-inset-bottom)))] border-t border-stone-100 bg-stone-50/60 space-y-2">
              {/* Settings Button */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 active:bg-stone-200/80 text-stone-700 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Settings className="w-3.5 h-3.5 text-stone-500" />
                <span>ตั้งค่าระบบ</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false);
                  await signOutUser();
                }}
                className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 active:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>

              <p className="text-[10px] font-medium text-stone-400 text-center">
                Fur Fur & • เฟอ เฟอ แอนด์
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
