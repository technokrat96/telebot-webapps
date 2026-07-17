export type UserRole = 'ADMIN' | 'FLORIST' | 'KURIR';
export type PaymentMethod = 'CASH' | 'BCA' | 'MANDIRI' | 'PAYPAL';
export type OrderSource = 'WA' | 'WEB';
export type ItemStatus = 'NEW ORDER' | 'ON PROGRESS' | 'DONE' | 'PENDING' | 'CANCELLED' | 'RESCHEDULED';
export type DeliveryMethod = 'DELIVERY' | 'PICKUP';
export type DeliveryStatus = 'PICKUP' | 'ON DELIVERY' | 'DELIVERED' | 'RECEIVED' | 'RETURNED';
export type CardStatus = 'NEW ORDER' | 'ON PROGRESS' | 'DONE' | 'CANCELLED';
export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface AppUser {
  USERNAME: string;
  NAME: string;
  ROLE: string;
}

export const ROLES: UserRole[] = ['ADMIN', 'FLORIST', 'KURIR'];
export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BCA', 'MANDIRI', 'PAYPAL'];
export const ORDER_SOURCES: OrderSource[] = ['WA', 'WEB'];
export const ITEM_STATUSES: ItemStatus[] = ['NEW ORDER', 'ON PROGRESS', 'DONE', 'PENDING', 'CANCELLED', 'RESCHEDULED'];
export const DELIVERY_METHODS: DeliveryMethod[] = ['DELIVERY', 'PICKUP'];
export const DELIVERY_STATUSES: DeliveryStatus[] = ['PICKUP', 'ON DELIVERY', 'DELIVERED', 'RECEIVED', 'RETURNED'];
export const CARD_STATUSES: CardStatus[] = ['NEW ORDER', 'ON PROGRESS', 'DONE', 'CANCELLED'];
export const INVOICE_STATUSES: InvoiceStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

export interface Transaction {
  ORDER_ID: string;
  ORDER_SOURCE: OrderSource;
  SALES_NAME: string;
  CUSTOMER_NAME: string;
  CUSTOMER_ADDRESS: string;
  CUSTOMER_PHONE: string;
  CUSTOMER_EMAIL: string;
  GRAND_TOTAL: number;
  DOWN_PAYMENT: number;
  REMAINING_BALANCE: number;
  PAYMENT_METHOD: PaymentMethod;
}

export interface TransactionDetail {
  ORDER_ITEM_ID: string;
  ORDER_ID: string;
  ITEM_NAME: string;
  QUANTITY: number;
  UNIT_PRICE: number;
  CUSTOM_NOTES: string;
  SUBTOTAL: number;
  ITEM_STATUS: ItemStatus;
  FLORIST_NAME: string;
  CARD_TO: string;
  CARD_MESSAGE: string;
  CARD_FROM: string;
  CARD_CREATED_BY: string;
  CARD_STATUS: CardStatus;
  DELIVERY_BY: string;
  DELIVERY_METHOD: DeliveryMethod;
  DELIVERY_DATE: string;
  DELIVERY_TIME: string;
  DELIVERY_STATUS: DeliveryStatus;
  SHIPPING_FEE: number;
  RECEIVER_NAME: string;
  RECEIVER_ADDRESS: string;
  RECEIVER_PHONE: string;
}

export interface Invoice {
  INVOICE_ID: string;
  INVOICE_NUMBER: string;
  INVOICE_DATE: string;
  DUE_DATE: string;
  TOTAL_AMOUNT: number;
  AMOUNT_PAID: number;
  INVOICE_STATUS: InvoiceStatus;
  BILLED_TO: string;
  BILLED_ADDRESS: string;
  BILLED_PHONE: string;
}

export interface InvoiceDetail {
  INVOICE_ITEM_ID: string;
  INVOICE_ID: string;
  ORDER_ITEM_ID: string;
  QUANTITY_BILLED: number;
  PRICE_BILLED: number;
}

export interface TransactionWithDetails extends Transaction {
  details: TransactionDetail[];
}

export interface InvoiceWithDetails extends Invoice {
  details: InvoiceDetail[];
}
