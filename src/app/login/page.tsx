"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  KeyRound,
  Delete,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { signInWithEmail, signInWithPin } from "@/app/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<"pin" | "email">("pin");

  // State สำหรับ PIN Mode
  const [pin, setPin] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State สำหรับ Email Mode
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ส่งคำขอเข้าสู่ระบบด้วย PIN
  const handlePinSubmit = useCallback(
    (pinToSubmit: string) => {
      if (pinToSubmit.length !== 4) return;
      setErrorMessage(null);

      startTransition(async () => {
        const res = await signInWithPin(pinToSubmit);
        if (res.success) {
          router.push("/pos");
          router.refresh();
        } else {
          setErrorMessage(res.error || "รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
          setPin(""); // เคลียร์ PIN เมื่อกรอกผิดเพื่อให้กดใหม่ได้ทันที
        }
      });
    },
    [router]
  );

  // จัดการการกดปุ่มตัวเลขบนหน้าจอ
  const handleNumberPress = (num: string) => {
    if (isPending || pin.length >= 4) return;
    setErrorMessage(null);

    const newPin = pin + num;
    setPin(newPin);

    // เมื่อกดครบ 4 หลัก ทำการ Submit ทันที
    if (newPin.length === 4) {
      handlePinSubmit(newPin);
    }
  };

  // ลบตัวเลขหลักล่าสุด
  const handleBackspace = () => {
    if (isPending || pin.length === 0) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  };

  // ล้างตัวเลขทั้งหมด
  const handleClear = () => {
    if (isPending) return;
    setErrorMessage(null);
    setPin("");
  };

  // รองรับการกดแป้นพิมพ์จริง (Physical Keyboard) บนคอมพิวเตอร์
  useEffect(() => {
    if (loginMode !== "pin") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPending) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleNumberPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loginMode, pin, isPending, handlePinSubmit]);

  // จัดการการส่งฟอร์มด้วยอีเมล & รหัสผ่าน
  const handleEmailSubmit = (e: React.FormEvent) => {
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

  return (
    <div className="min-h-dvh bg-stone-100 flex flex-col justify-center items-center p-4 selection:bg-amber-100">
      <div className="max-w-md w-full space-y-5">
        {/* Header / Logo */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-3xl overflow-hidden bg-[#F9D56E] border-2 border-amber-300 shadow-xl shadow-amber-500/20 mx-auto mb-3 flex items-center justify-center">
            <img
              src="/icons/icon-512x512.png"
              alt="Fur Fur & Logo"
              className="w-full h-full object-cover"
            />
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
          {/* Segmented Mode Selector */}
          <div className="flex rounded-2xl bg-stone-100 p-1 border border-stone-200/60">
            <button
              type="button"
              onClick={() => {
                setLoginMode("pin");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                loginMode === "pin"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>กดรหัส PIN หน้าร้าน</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("email");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                loginMode === "email"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-stone-600" />
              <span>อีเมล & รหัสผ่าน</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center animate-in fade-in">
              {errorMessage}
            </div>
          )}

          {/* ======================= PIN MODE ======================= */}
          {loginMode === "pin" && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <p className="text-xs font-semibold text-stone-500">
                  กดรหัส PIN 4 หลักเพื่อเข้าสู่ระบบปฏิบัติงาน
                </p>

                {/* 4 PIN Dots Indicator */}
                <div className="flex justify-center items-center gap-4 py-2">
                  {[0, 1, 2, 3].map((index) => {
                    const isFilled = pin.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                          isFilled
                            ? "bg-amber-600 border-2 border-amber-600 scale-125 shadow-md shadow-amber-600/30"
                            : "bg-stone-100 border-2 border-stone-300"
                        }`}
                      />
                    );
                  })}
                </div>

                {isPending && (
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังตรวจสอบสิทธิ์...</span>
                  </div>
                )}
              </div>

              {/* 3x4 Touch Keypad Grid */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumberPress(num)}
                    disabled={isPending || pin.length >= 4}
                    className="h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-amber-100 active:scale-95 text-stone-900 text-2xl font-bold border border-stone-200/80 shadow-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}

                {/* ปุ่มล้าง (C) */}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isPending || pin.length === 0}
                  className="h-16 rounded-2xl bg-stone-100/70 hover:bg-stone-200/70 active:scale-95 text-stone-600 text-xs font-bold border border-stone-200/80 shadow-xs flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4 text-stone-500" />
                  <span className="text-[10px]">ล้าง</span>
                </button>

                {/* ปุ่มเลข 0 */}
                <button
                  type="button"
                  onClick={() => handleNumberPress("0")}
                  disabled={isPending || pin.length >= 4}
                  className="h-16 rounded-2xl bg-stone-50 hover:bg-stone-100 active:bg-amber-100 active:scale-95 text-stone-900 text-2xl font-bold border border-stone-200/80 shadow-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  0
                </button>

                {/* ปุ่มลบ (Backspace) */}
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isPending || pin.length === 0}
                  className="h-16 rounded-2xl bg-stone-100/70 hover:bg-stone-200/70 active:scale-95 text-stone-700 text-sm font-bold border border-stone-200/80 shadow-xs flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Delete className="w-5 h-5 text-stone-600" />
                  <span className="text-[10px]">ลบ</span>
                </button>
              </div>

              {/* Hint Box สำหรับการตั้งค่าและความปลอดภัย */}
              <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 space-y-1 bg-amber-50/50 p-3 rounded-2xl border border-amber-200/40">
                <div className="flex items-center gap-1 font-bold text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>รหัส PIN ประจำร้าน (POS Passcode):</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-stone-600 pl-4">
                  <div>• พนักงาน / ช่าง: <code className="bg-amber-100/70 px-1 rounded font-bold text-amber-950">1234</code></div>
                  <div>• เจ้าของ / ผจก.: <code className="bg-amber-100/70 px-1 rounded font-bold text-amber-950">8888</code></div>
                </div>
                <p className="text-[10px] text-stone-400 pl-4">
                  * ปรับเปลี่ยนรหัสได้ตลอดเวลาใน Environment Variables ของ Vercel
                </p>
              </div>
            </div>
          )}

          {/* ======================= EMAIL MODE ======================= */}
          {loginMode === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-600 block mb-1.5">
                  อีเมลผู้ใช้งาน (Supabase Auth)
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
                  <span>เข้าสู่ระบบด้วยอีเมล (Sign In)</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security Footer */}
        <div className="text-center flex items-center justify-center gap-1.5 text-[11px] text-stone-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>ระบบป้องกันข้อมูลยอดขายด้วย PIN Keypad และ RBAC</span>
        </div>
      </div>
    </div>
  );
}
