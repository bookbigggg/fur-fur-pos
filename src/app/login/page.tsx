"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Scissors, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Loader2, 
  ShieldCheck, 
  UserCheck,
  Crown,
  KeyRound
} from "lucide-react";
import { signInWithEmail, signInWithPreset } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // จัดการการส่งฟอร์มเข้าสู่ระบบ
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await signInWithEmail(email, password);
      if (res.success) {
        router.push("/pos");
        router.refresh();
      } else {
        setErrorMessage(res.error || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
    });
  };

  // ทางลัดเข้าสู่ระบบด้วยสิทธิ์พนักงาน / เจ้าของร้าน (Fast Terminal Login)
  const handleQuickLogin = (role: "owner" | "staff") => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await signInWithPreset(role);
      if (res.success) {
        router.push("/pos");
        router.refresh();
      } else {
        setErrorMessage(res.error || "ไม่สามารถเข้าสู่ระบบได้");
      }
    });
  };

  return (
    <div className="min-h-dvh bg-stone-100 flex flex-col justify-center items-center p-4 selection:bg-amber-100">
      <div className="max-w-md w-full space-y-6">
        {/* Header / Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-amber-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-600/20 mb-3">
            <Scissors className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Fur Fur &
          </h1>
          <p className="text-xs font-semibold text-stone-500">
            เฟอ เฟอ แอนด์ • ระบบคิดเงินหน้าร้าน POS
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-stone-200/80 space-y-5">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>เข้าสู่ระบบเพื่อปฏิบัติงาน</span>
            </h2>
            <span className="text-[11px] font-medium text-stone-400">
              Terminal POS
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5">
                อีเมลผู้ใช้งาน
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@furfurand.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full min-h-[44px] text-base sm:text-xs font-medium pl-9 pr-3 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/50"
                  disabled={isPending}
                />
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full min-h-[44px] text-base sm:text-xs font-medium pl-9 pr-11 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-stone-50/50"
                  disabled={isPending}
                />
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-10 h-10 flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer active:scale-95"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !email || !password}
              className="w-full min-h-[44px] bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบ (Sign In)</span>
              )}
            </button>
          </form>

          {/* Quick Terminal Login Presets */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <span className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider text-center">
              หรือเข้าสู่ระบบด่วนประจำเครื่องหน้าร้าน
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("staff")}
                disabled={isPending}
                className="p-3 rounded-2xl border border-stone-200 hover:border-amber-500 bg-stone-50/70 hover:bg-amber-50/40 text-left transition-all group active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-stone-600 group-hover:text-amber-600" />
                  <span className="text-xs font-bold text-stone-800">
                    แคชเชียร์ / ช่าง
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">
                  สิทธิ์หน้าร้าน: คิดเงิน, เปิดบิล, ปิดกะ
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("owner")}
                disabled={isPending}
                className="p-3 rounded-2xl border border-amber-300 bg-amber-50/40 hover:bg-amber-100/50 text-left transition-all group active:scale-95 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Crown className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-xs font-bold text-amber-950">
                    เจ้าของ / ผจก.
                  </span>
                </div>
                <p className="text-[10px] text-amber-800 leading-tight">
                  เต็มสิทธิ์: งบกำไร-ขาดทุน, เคลียร์คู่ค้า
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center flex items-center justify-center gap-1.5 text-[11px] text-stone-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ระบบรักษาความปลอดภัยข้อมูลยอดขายและสิทธิ์การเข้าถึง (RBAC)</span>
        </div>
      </div>
    </div>
  );
}
