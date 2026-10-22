<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🐾 Fur Fur & (เฟอ เฟอ แอนด์) POS — Agent System & Development Guide

ยินดีต้อนรับสู่ **Fur Fur & POS** ระบบบริหารจัดการหน้าร้านและการเงิน (Point of Sale & Financial Management) สำหรับร้านกรูมมิ่งสัตว์เลี้ยง **Fur Fur & (เฟอ เฟอ แอนด์)** พัฒนาขึ้นเพื่อทดแทน Google Sheets 100% เน้นการใช้งานแบบ Mobile/iPad-first และรองรับมาตรฐานบัญชี TFRS 15

---

## 🏛️ 1. บริบทธุรกิจและกฎเหล็ก (Business Rules & Non-Negotiables)

1. **ผู้มีอำนาจและการเงิน (Ownership & Cash Control):**
   * ผู้ดูแลการเงินและร้าน: คุณบุ๊ค และ **คุณฟาริ บุญเย็น** (ผู้จัดการร้าน)
   * เจ้าของร้าน 2 คนดูแลเงินเอง 100% พนักงานทั่วไปไม่มีสิทธิ์แตะต้องเก๊ะเงินสด
   * เอกสารใบสรุปยอดฝากขาย A4 PDF ต้องระบุลายเซ็นและชื่อ **"ฟาริ บุญเย็น"** เสมอ
2. **มาตรฐานบัญชีคูปองเงินสด (TFRS 15 Accounting):**
   * เงินสดที่รับล่วงหน้าจากการขายแพ็กเกจคูปอง (เช่น จ่าย 3,000 ได้เครดิต 3,300) ต้องบันทึกเป็น **หนี้สิน (Unearned Revenue)**
   * การรับรู้รายได้ (Revenue Recognition) จะทยอยรับรู้จริงตามสัดส่วน (Proportional) เมื่อลูกค้านำคูปองมาใช้บริการตัดขน/อาบน้ำ
3. **ระบบสมาชิกรายปี (Annual Membership 299.-/ปี):**
   * ให้สิทธิ์ส่วนลด 10% สำหรับค่าบริการกรูมมิ่ง
   * รองรับ **Smart Early Renewal:** หากลูกค้าต่ออายุสมาชิกล่วงหน้าก่อนหมดอายุ ให้นำ 365 วันไปบวกทบจากวันหมดอายุเดิม ห้ามตัดวันคงเหลือเดิมทิ้ง
4. **สินค้าฝากขาย & เคลียร์ยอดคู่ค้า (Consignment Settlement):**
   * หัก GP ร้านตาม % หรือยอดโอนคืนคงที่ที่ตกลงไว้
   * รอบการเคลียร์ยอดตั้งต้นที่ **"เดือนที่แล้ว"**
   * ห้ามพิมพ์ใบสรุปยอดสำหรับแบรนด์ที่ไม่มีรายการขายในรอบเดือน
5. **การบันทึกบิลย้อนหลัง (Backdated Orders):**
   * หากมีการเลือกวันย้อนหลัง ต้องซิงค์ทั้ง `order_date` และ `created_at` (เวลา `12:00:00 น.` ของวันนั้น) เพื่อให้รายงานประจำเดือนถูกต้อง 100%
6. **การ Void บิล (ยกเลิกคำสั่งซื้อ):**
   * ต้องคืนเครดิตคูปอง, คืนสต็อกสินค้าฝากขาย, และบันทึก Audit Trail ห้ามลบข้อมูลดิบออกจาก Database

---

## ⚡ 2. สถาปัตยกรรมเทคโนโลยี (Tech Stack & Architecture)

* **Framework:** Next.js 16 (App Router), React 19, TypeScript (Strict Mode)
* **Styling:** Tailwind CSS v4, Lucide Icons, Custom Print Stylesheet (80mm Thermal & A4 Landscape/Portrait PDF)
* **Database & Auth:** Supabase PostgreSQL SSR (`@supabase/ssr`), Row-Level Security (RLS)
* **PWA & Mobile Native-like:** Standalone Display, Viewport-fit cover, Touch-action manipulation, 16px font-size protection

---

## 📐 3. กฎการเขียนโค้ดสำหรับ AI (Coding Standards)

1. **Next.js 16 Server Actions:**
   * ไฟล์ที่มีคำสั่ง `"use server"` ต้อง export เฉพาะฟังก์ชันแบบ **`async`** เท่านั้น
   * **ห้าม export ค่าคงที่ (constants) หรือ helper ธรรมดาออกจากไฟล์ `"use server"`** ให้แยกไปไว้ที่ `src/lib/`
2. **Mobile UX & Anti-Zoom (iOS Safari):**
   * ช่องกรอกข้อมูล Form Input บนจอมือถือ (หน้าจอ `<= 768px`) ต้องมี `font-size` ไม่ต่ำกว่า `16px` เสมอ เพื่อป้องกันไม่ให้ iOS Safari ซูมหน้าจออัตโนมัติ
   * เมื่อเลือกรายการเสร็จ (เช่น เลือกสัตว์เลี้ยง/ลูกค้า) ให้สั่ง `blur()` แป้นพิมพ์ลงทันที
3. **ป้องกัน Race Condition ในเลขบิล:**
   * เลขบิล (เช่น `#GRM-202610-0001`) ต้องสร้างผ่าน Atomic PostgreSQL Sequences (`order_sequences` table) ห้าม SELECT max() + 1 ใน Application layer
4. **Reactive Store Settings:**
   * การเปิด-ปิดระบบปิดกะ และค่าคอมมิชชั่นช่าง จัดเก็บใน `localStorage` (`furfur_store_settings`) และเชื่อมต่อผ่าน Event Hook ใน `src/lib/settings.ts`

---

## ✅ 4. ขั้นตอนการตรวจสอบและการส่งมอบงาน (Verification & Auto-Deployment Workflow)

ก่อนส่งมอบงานทุกครั้ง ต้องรันคำสั่งตรวจสอบและ Push ขึ้น Production ทันที:
```bash
# 1. ตรวจสอบ Type Safety ทั้งหมด (ต้อง 0 errors)
npx tsc --noEmit

# 2. ตรวจสอบการ Build Production (ต้องผ่าน 100%)
npm run build

# 3. อัปเดต spec.md ตามจริง

# 4. Commit และ Push ขึ้น Production ทันทีโดยอัตโนมัติ
git add .
git commit -m "..."
git push origin main
```

> [!IMPORTANT]
> **กฎเหล็กเรื่องการ Push ขึ้น Vercel (Auto-Deployment):**
> * ตัว AI Agent ต้อง **Commit & Push ขึ้น GitHub (`origin main`) โดยอัตโนมัติทันทีที่เสร็จงาน** เพื่อให้ Vercel Auto-Deploy
> * **ห้ามทิ้งโค้ดค้างไว้ใน Local หรือรอให้ผู้ใช้มาคอยทวงถามเด็ดขาด**
> * เมื่อ Push สำเร็จแล้ว จึงค่อยสรุปผลการทำงานและแจ้งเลข Commit ให้ผู้ใช้ทราบในคำตอบสุดท้าย

---

## 📝 5. การอัปเดต `spec.md` อย่างต่อเนื่อง (Continuous spec.md Maintenance)

* **Living Document:** ไฟล์ `spec.md` คือ Single Source of Truth ของโปรเจกต์
* **ข้อกำหนดสำหรับ AI Agent ทุกตัว:** ทุกครั้งที่มีการพัฒนาฟีเจอร์ใหม่, ปรับแก้ Business Logic, แก้ไขโครงสร้าง Database, หรือขยับ Milestone/Version จะต้องทำการ **อัปเดตสถานะใน `spec.md` เสมอ**
* เพื่อให้การเปิด Chat ใหม่ในอนาคต ตัว Agent จะทราบขั้นตอนความคืบหน้าล่าสุดได้ทันทีแบบ 100% โดยไม่ต้องเริ่มบริบทใหม่

