// src/lib/store-profile.ts

/**
 * ข้อมูลทางการของร้าน Fur Fur & (เฟอ เฟอ แอนด์)
 * อ้างอิงจาก Knowledge Base และเอกสารทางการของธุรกิจ
 */
export const STORE_PROFILE = {
  name: "FUR FUR &",
  nameTh: "เฟอ เฟอ แอนด์",
  branch: "ปั๊ม ปตท. เลียบทางด่วนทุ่งครุ",
  address: "26/4 ถ.เลียบทางด่วน แขวงทุ่งครุ เขตทุ่งครุ กรุงเทพมหานคร 10140",
  shortAddress: "26/4 ถ.เลียบทางด่วน แขวงทุ่งครุ เขตทุ่งครุ กทม. 10140",
  phone: "081-444-0096",
  lineId: "@furfurand",
  status: "เปิดให้บริการปกติ",
  bank: {
    bankName: "ธนาคารกสิกรไทย (KBank)",
    shortBank: "ธ.กสิกรไทย",
    accountNumber: "238-3-46287-0",
    rawAccountNumber: "2383462870",
    accountName: "เฟอ เฟอ แอนด์",
    qrImageUrl: "/images/QR-Payment-Fur-Fur.jpg",
  },
} as const;

export type StoreProfile = typeof STORE_PROFILE;
