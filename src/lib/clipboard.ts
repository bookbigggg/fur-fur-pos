// src/lib/clipboard.ts

/**
 * ฟังก์ชันคัดลอกข้อความลง Clipboard ที่รองรับทั้ง HTTPS/localhost และ HTTP ในวงแลน (Local IP) บนอุปกรณ์ iOS/Android
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. ลองใช้ navigator.clipboard มาตรฐาน (ทำงานเมื่อต่อ HTTPS หรือ localhost)
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn("navigator.clipboard.writeText failed, using fallback:", e);
    }
  }

  // 2. Fallback สำหรับกรณีเปิดผ่าน IP บนเครือข่ายภายใน (HTTP) เช่น http://192.168.x.x:3000
  if (typeof document === "undefined") return false;

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.fontSize = "16px"; // ป้องกัน iOS Safari auto-zoom

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
}
