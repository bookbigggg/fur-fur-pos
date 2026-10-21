export type Species = 'หมา' | 'แมว' | 'อื่นๆ';
export type UserRole = 'owner' | 'manager' | 'staff';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
export type MembershipStatus = 'ใช้งานได้' | 'ใกล้หมดอายุ' | 'หมดอายุ';
export type CouponStatus = 'ใช้งานได้' | 'ใช้หมดแล้ว' | 'ยกเลิก';
export type CouponTransactionType = 'deduct' | 'topup' | 'refund' | 'initial';
export type OrderType = 'grooming' | 'retail' | 'membership' | 'coupon';
export type PaymentMethod = 'โอนเงิน' | 'โอนเงิน/QR' | 'เงินสด' | 'บัตรเครดิต' | 'หักคูปอง';
export type ClearingStatus = 'รอเคลียร์' | 'เคลียร์แล้ว';
export type ExpenseCategory = 
  | 'ค่าเช่าและสถานที่' 
  | 'สาธารณูปโภค (น้ำ/ไฟ)' 
  | 'เงินเดือนและค่าจ้าง' 
  | 'ของใช้สิ้นเปลือง' 
  | 'การตลาด/โฆษณา' 
  | 'บำรุงรักษา/อุปกรณ์' 
  | 'จิปาถะ/อื่นๆ';

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  customer_id: string;
  pet_code?: string | null;
  name: string;
  species: Species;
  breed?: string | null;
  weight_kg?: number | null;
  health_notes?: string | null;
  created_at: string;
  updated_at: string;
  active_membership?: AnnualMembership | null;
  active_coupons?: Coupon[];
}

export interface AnnualMembership {
  id: string;
  pet_id: string;
  member_code?: string | null;
  fee: number;
  start_date: string;
  expire_date: string;
  status: MembershipStatus;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  pet_id: string;
  coupon_code?: string | null;
  package_value: number;
  paid_amount: number;
  remaining_balance: number;
  status: CouponStatus;
  expire_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponTransaction {
  id: string;
  coupon_id: string;
  order_id?: string | null;
  transaction_type: CouponTransactionType;
  amount: number;
  balance_before?: number | null;
  balance_after?: number | null;
  notes?: string | null;
  created_at: string;
  order?: {
    id: string;
    order_number: string;
    order_date: string;
    service_description?: string | null;
    net_paid: number;
  } | null;
}

export interface CouponCustomerInfo {
  id: string;
  name: string;
  phone?: string | null;
}

export interface CouponPetInfo {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  weight_kg?: number | null;
  customer?: CouponCustomerInfo | null;
}

export interface CouponWithDetails extends Coupon {
  pet?: CouponPetInfo | null;
  transaction_count?: number;
}

export interface CouponSummaryKPI {
  totalCoupons: number;
  activeCount: number;
  exhaustedCount: number;
  totalRemainingCredit: number;
  totalPaidAmount: number;
  totalPackageValue: number;
  totalLiability: number;
  totalUsedCredit: number;
}

export type OrderStatus = 'completed' | 'voided' | 'ยกเลิก';

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string | null;
  pet_id?: string | null;
  order_type: OrderType;
  service_description?: string | null;
  full_price: number;
  discount_text: string;
  coupon_deducted: number;
  recognized_coupon_income: number;
  net_paid: number;
  staff_commission: number;
  shop_net_income: number;
  coupon_id?: string | null;
  payment_method: PaymentMethod;
  status?: OrderStatus | string;
  void_reason?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  order_date: string;
  created_at: string;
  updated_at: string;
}
export interface Product {
  id: string;
  product_code?: string | null;
  name: string;
  brand_group: string;
  selling_price: number;
  cost_price: number;
  gp_rate: number;
  remit_amount: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OrderRetailItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  brand_group: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cost_price: number;
  gp_rate: number;
  shop_profit: number;
  remit_amount: number;
  clearing_status: ClearingStatus;
  cleared_at?: string | null;
  created_at: string;
}

export interface DailyClosing {
  id: string;
  closing_date: string;
  closed_at: string;
  closed_by: string;
  total_orders_count: number;
  system_total_sales: number;
  system_cash_amount: number;
  cash_expenses?: number;
  system_transfer_amount: number;
  system_coupon_deducted: number;
  actual_cash_amount: number;
  cash_difference: number;
  opening_drawer_float: number;
  cash_transferred_out: number;
  notes?: string | null;
  status: string;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory | string;
  amount: number;
  payment_method: string;
  title: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}
