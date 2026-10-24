# 🐾 Fur Fur & (เฟอ เฟอ แอนด์) POS — System Specification & Status (`spec.md`)

> **Single Source of Truth** สำหรับ AI Agent และทีมพัฒนาในการตรวจสอบบริบท สถานะปัจจุบัน กฎเหล็กทางธุรกิจ และสถาปัตยกรรมของระบบ

---

## 📍 1. สถานะปัจจุบันของโครงการ (Current Stage & Milestones)

* **สถานะระบบ:** 🟢 **Production Live & Deployed (พร้อมใช้งานจริงหน้าร้าน 100%)**
* **เวอร์ชันล่าสุด:** `v1.4.3` (แก้ไขปัญหาบันทึกรายจ่ายร้าน Expense ล้มเหลวจากคอลัมน์ `created_by` ด้วย Self-Healing Fallback และจัดทำ Migration Script รองรับ Schema Cache)
* **GitHub Repository:** [`https://github.com/bookbigggg/fur-fur-pos`](https://github.com/bookbigggg/fur-fur-pos) (Branch: `main`)
* **Deployment Platform:** Vercel (Auto-deploy ผ่าน GitHub)
* **ฐานข้อมูล (Database):** Supabase PostgreSQL SSR (Project Ref: `gcybyruqacudlzsvxoll`)
* **สถานะ Data Migration & Backdated Orders:** 
  * นำเข้าข้อมูลจริง 100% จาก Google Sheet Master (`FurFur_Grooming_Master_V2`) เมื่อวันที่ 19-20 ต.ค. 2026
  * บิลประวัติกรูมมิ่ง: 142 บิล (`GRM-0001` ถึง `GRM-0142`)
  * บิลประวัติสินค้าปลีก: 16 บิล (`SALE-0001` ถึง `SALE-0016`)
  * บิลประวัติสมาชิกรายปี: 4 บิล (`MEM-202610-0001` ถึง `MEM-202610-0004` ยอด 1,196.- เข้างบ P&L เดือน ต.ค. 2026 ครบถ้วน)
  * ลูกค้า: 73 ราย (ผูกข้อมูลสัตว์เลี้ยงและประวัติครบถ้วน)
  * สัตว์เลี้ยง: 87 ตัว (ผูกรหัส `PET-xxxx` และเจ้าของเรียบร้อย 100%)
  * Master สินค้า: 49 รายการ (พร้อมราคา, GP, ต้นทุน, ยอดโอนคืน)
  * สมาชิกรายปี: 4 ราย (`MEM-001` ถึง `MEM-004`)
  * บิลประวัติแพ็กเกจคูปอง: 1 บิล (`CPN-202609-0001` ยอด 3,000.- ผูกกับ `CP-001` นิโกะ ชิบะ ครบถ้วน)
  * คูปองเงินสด: 1 รายการ (`CP-001` นิโกะ ชิบะ)
  * รายจ่ายร้าน: 32 รายการ (`EXP-001` ถึง `EXP-032`)

---

## 🏛️ 2. ผู้มีอำนาจและกฎเหล็กธุรกิจ (Core Business Rules & Constraints)

1. **ผู้มีอำนาจและการเงิน (Ownership & Cash Control):**
   * ผู้ดูแลเงินและร้าน: **คุณบุ๊ค** และ **คุณฟาริ บุญเย็น** (ผู้จัดการร้าน)
   * เจ้าของร้าน 2 คนดูแลเงินเอง 100% พนักงานทั่วไปไม่มีสิทธิ์แตะต้องเก๊ะเงินสด
   * เอกสารใบสรุปยอดฝากขาย A4 PDF ต้องระบุลายเซ็นและชื่อ **"ฟาริ บุญเย็น"** เสมอ
2. **รหัสผ่านเข้าใช้งานระบบหน้าร้าน (PIN Access):**
   * **เจ้าของร้าน / ผู้จัดการ:** `8888`
   * **พนักงาน / ช่าง:** `1234`
3. **มาตรฐานบัญชีคูปองเงินสด (TFRS 15 Accounting):**
   * เงินสดที่รับล่วงหน้าจากการขายแพ็กเกจคูปอง (เช่น จ่าย 3,000 ได้เครดิต 3,300) ต้องบันทึกเป็น **หนี้สิน (Unearned Revenue)**
   * การรับรู้รายได้ (Revenue Recognition) จะทยอยรับรู้จริงตามสัดส่วน (Proportional) เมื่อลูกค้านำคูปองมาใช้บริการตัดขน/อาบน้ำ
4. **ระบบสมาชิกรายปี (Annual Membership 299.-/ปี):**
   * ให้สิทธิ์ส่วนลด 10% สำหรับค่าบริการกรูมมิ่ง
   * รองรับ **Smart Early Renewal:** หากลูกค้าต่ออายุสมาชิกล่วงหน้าก่อนหมดอายุ ให้นำ 365 วันไปบวกทบจากวันหมดอายุเดิม ห้ามตัดวันคงเหลือเดิมทิ้ง
5. **สินค้าฝากขาย & เคลียร์ยอดคู่ค้า (Consignment Settlement):**
   * หัก GP ร้านตาม % หรือยอดโอนคืนคงที่ที่ตกลงไว้
   * รอบการเคลียร์ยอดตั้งต้นที่ **"เดือนที่แล้ว"**
   * ห้ามพิมพ์ใบสรุปยอดสำหรับแบรนด์ที่ไม่มีรายการขายในรอบเดือน
6. **การบันทึกบิลย้อนหลัง (Backdated Orders):**
   * ซิงค์ทั้ง `order_date` และเวลา `created_at` (`12:00:00 น.` ของวันนั้น) เพื่อให้รายงานบัญชีประจำเดือนถูกต้อง 100%
7. **การ Void บิล (ยกเลิกคำสั่งซื้อ):**
   * คืนเครดิตคูปอง, คืนสต็อกสินค้าฝากขาย, และบันทึก Audit Trail ห้ามลบข้อมูลดิบออกจาก Database
8. **ข้อความสรุปยอดส่งลูกค้า (LINE Billing Summary):**
   * เน้นความกระชับ อ่านง่าย จบใน 1 จอมือถือ ไม่ใส่ข้อมูลร้านซ้ำซ้อน ไม่ใส่เลขบิลยาว
   * แสดงยอด "คูปองคงเหลือ" อัตโนมัติเมื่อมีการตัดคูปอง
   * หากยอดสุทธิเป็น 0 บาท (ตัดคูปองครบ) จะไม่แสดงเลขที่บัญชีธนาคารเพื่อป้องกันความสับสน
   * ใช้คำลงท้าย "นะคะ" (ไม่ใช้ /ครับ) และจัดวางเลขบัญชีกับชื่อบัญชีติดกันเพื่อให้ลูกค้าคัดลอกง่ายที่สุด

---

## ⚡ 3. สถาปัตยกรรมทางเทคนิค (Tech Stack)

* **Framework:** Next.js 16 (App Router), React 19, TypeScript (Strict Mode)
* **Styling:** Tailwind CSS v4, Lucide Icons, Custom Print Stylesheet (80mm Thermal Slip & A4 Landscape/Portrait PDF)
* **Database & Auth:** Supabase PostgreSQL SSR (`@supabase/ssr`), Row-Level Security (RLS)
* **Sequential Numbering:** Atomic PostgreSQL Sequences (`order_sequences` table) ป้องกัน Race Condition
* **PWA & Mobile Native-like:** Standalone Display, Viewport-fit cover, iOS 16px font anti-autozoom, Keyboard auto-dismiss

---

## 🗺️ 4. แผนผังหน้าจอและฟีเจอร์ (Site Structure & Routes)

| เส้นทาง (Route) | ฟังก์ชันการทำงานหลัก |
|---|---|
| `/pos` | หน้าร้านหลัก: เลือกลูกค้า/สัตว์เลี้ยง, บันทึกบิลกรูมมิ่ง/สินค้าปลีก/คูปอง/สมาชิก, เลือกวันย้อนหลัง |
| `/customers` | ระบบบริหารลูกค้าและสัตว์เลี้ยง (Customer CRM): ค้นหา/กรอง, จัดการข้อมูลลูกค้า, ข้อมูลสัตว์เลี้ยง, ดูประวัติบิลย้อนหลัง และกดเปิดบิล POS |
| `/orders` | ประวัติบิลคำสั่งซื้อ (แสดงชื่อสัตว์เลี้ยงเป็นหัวเรื่องหลัก, แสดงบริการและชื่อลูกค้าในคำอธิบายรอง, แก้ไขการตรวจจับชิปบริการผิดพลาดเป็นชื่อสัตว์), Daily Dashboard ยอดขายวันนี้, พิมพ์สลิปความร้อน 80mm, Void บิล |
| `/settlement` | ระบบเคลียร์ยอดสินค้าฝากขายประจำเดือนตามรอบบัญชี |
| `/settlement/[brand]` | เอกสารใบสรุปยอดฝากขายขนาด A4 PDF แยกแบรนด์ พร้อมลายเซ็นคุณฟาริ บุญเย็น |
| `/coupons` | ระบบบริหารและสรุปยอดแพ็กเกจ & สมาชิก: สลับแท็บคูปองเงินสด (TFRS 15, ยอดคงเหลือ, ประวัติหักยอด) และ สมาชิกรายปี 299 (นับถอยหลังวันหมดอายุ, สมาชิกใกล้หมดอายุ, Smart Renewal) |
| `/expenses` | งบกำไร-ขาดทุน (P&L) แบบ Real-time และบันทึกค่าใช้จ่ายดำเนินงานร้าน (OpEx) |
| `/closing` | ระบบปิดกะ & นับเงินสดประจำวัน (ซ่อน/เปิดได้จากเมนูตั้งค่า ⚙️) |

---

## ✅ 5. แนวทางการพัฒนาและตรวจสอบโค้ด (Coding & Verification Standards)

1. **Next.js 16 Server Actions:** ไฟล์ `"use server"` ต้อง export เฉพาะ `async function` เท่านั้น ห้าม export ค่าคงที่ (constants) ออกจากไฟล์ `"use server"` ให้แยกไว้ที่ `src/lib/`
2. **Type Safety & Build Verification:** ทุกครั้งก่อน commit หรือส่งมอบงาน ต้องรันผ่าน 100%:
   ```bash
   npx tsc --noEmit   # ต้อง 0 errors
   npm run build      # ต้อง Build สำเร็จ 100%
   ```

---

## 🎨 6. แบรนด์และไอคอนระบบ (Branding & Assets)

* **โลโก้และมาสคอตหลัก:** สุนัขชเนาเซอร์ตาโต โผล่จากขอบล่าง (Peeking Pup Concept) สายตามองช้อนขึ้น
* **สีหลักของแบรนด์ (Primary Palette):**
  * `Butter Yellow` (`#F9D56E`): สีพื้นหลังไอคอนหลักและสื่อประชาสัมพันธ์
  * `Amber/Gold Accent` (`#D97706` / `#B45309`): โทนสีเน้น UI ปุ่มและข้อความหัวแบรนด์
* **PWA & App Icons Asset Setup:**
  * `public/icons/apple-touch-icon.png` (180x180 px) — ไอคอน Bookmark / Home Screen บน iOS & iPadOS
  * `public/icons/icon-192x192.png` & `public/icons/icon-512x512.png` — รองรับ Web App Manifest PWA Standalone
  * `public/favicon.ico` & `src/app/favicon.ico` — Multi-size Favicon บนแท็บเบราว์เซอร์
  * ติดตั้งไอคอนใหม่ลงใน Header Navbar (`Navbar.tsx`) และหน้าจอ Login (`login/page.tsx`) แทนที่ไอคอนกรรไกรเดิม

