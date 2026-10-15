"use client";

import { Printer } from "lucide-react";

interface PrintButtonProps {
  statementNumber?: string;
}

export default function PrintButton({ statementNumber }: PrintButtonProps) {
  const handlePrint = () => {
    const originalTitle = document.title;
    if (statementNumber) {
      document.title = statementNumber;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center justify-center min-h-[44px] gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
    >
      <Printer className="w-4 h-4" />
      <span>พิมพ์หรือบันทึก PDF</span>
    </button>
  );
}
