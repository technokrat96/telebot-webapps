export interface User {
  USERNAME: string;
  NAME: string;
  ROLES: string;
}
export type Transaction = {
  ORDER_ID: string;
  ORDER_SOURCE: string;
  SALES_NAME: string;
  CUSTOMER_NAME: string;
  CUSTOMER_ADDRESS: string;
  CUSTOMER_PHONE: string;
  CUSTOMER_EMAIL: string;
  GRAND_TOTAL: number;
  DOWN_PAYMENT: number;
  REMAINING_BALANCE: number;
  PAYMENT_METHOD: string;
}

export type TransactionDetail = {
  ORDER_ITEM_ID: string;
  ORDER_ID: string;
  ITEM_NAME: string;
  QUANTITY: number;
  UNIT_PRICE: number;
  CURRENCY: string;
  CURRENCY_RATE: number;
  CUSTOM_NOTES: string;
  SUBTOTAL: number;
  ITEM_STATUS: string;
  CARD_TO: string;
  CARD_MESSAGE: string;
  CARD_FROM: string;
  CARD_NOTE: string;
  CARD_CREATED_BY: string;
  CARD_STATUS: string;
  DELIVERY_BY: string;
  DELIVERY_METHOD: string;
  DELIVERY_DATE: string;
  DELIVERY_TIME: string;
  DELIVERY_STATUS: string;
  SHIPPING_FEE: number;
  RECEIVER_NAME: string;
  RECEIVER_ADDRESS: string;
  RECEIVER_PHONE: string;
}

export type Invoice = {
  INVOICE_ID: string;
  INVOICE_NUMBER: string;
  INVOICE_DATE: string;
  DUE_DATE: string;
  TOTAL_AMOUNT: number;
  AMOUNT_PAID: number;
  INVOICE_STATUS: string;
  BILLED_TO: string;
  BILLED_ADDRESS: string;
  BILLED_PHONE: string;
}

export type InvoiceDetail = {
  INVOICE_ITEM_ID: string;
  INVOICE_ID: string;
  ORDER_ITEM_ID: string;
  QUANTITY_BILLED: number;
  PRICE_BILLED: number;
}

export type FloristAssignment = {
  ASSIGNMENT_ID: string;
  ORDER_ITEM_ID: string;
  ORDER_ID: string;
  FLORIST_USERNAME: string;
  FLORIST_NAME: string;
  QUANTITY_ASSIGNED: number;
  ASSIGNED_AT: string;
  STATUS: string;
  COMPLETED_AT: string;
}

export type MasterData = {
  ROLES: string[];
  PAYMENT_METHODS: string[];
  ORDER_SOURCES: string[];
  ITEM_STATUSES: string[];
  DELIVERY_METHODS: string[];
  DELIVERY_STATUSES: string[];
  CARD_STATUSES: string[];
  INVOICE_STATUSES: string[];
  FLORIST_ASSIGNMENT_STATUSES: string[];
  CURRENCY: { label: string; value: string; locale: string; rate: number }[];
}

export type AvailableFloristItem = TransactionDetail & {
  ORDER_ID: string;
  CUSTOMER_NAME: string;
  totalQty: number;
  remainingQty: number;
};

export type MyFloristAssignment = FloristAssignment & {
  item?: TransactionDetail & { CUSTOMER_NAME: string };
};

export type TransactionWithDetails = Transaction & {
  details: TransactionDetail[];
}

export type InvoiceWithDetails = Invoice & {
  details: InvoiceDetail[];
}

export type TransactionDetailWithAssignments = TransactionDetail & {
  assignments: FloristAssignment[];
};

export type TransactionWithDetailsAndAssignments = Transaction & {
  details: TransactionDetailWithAssignments[];
};