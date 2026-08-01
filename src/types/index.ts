export interface User {
  CHAT_ID: string | null;
  TELEGRAM_ID: string | null;
  USERNAME: string;
  NAME: string;
  ROLES: string[];
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
  // ID order Shopify asal (dari webhook /api/webhook/shopify). Kosong untuk
  // transaksi yang dibuat manual lewat form admin.
  SHOPIFY_ORDER_ID?: string;
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
  DELIVERY_METHOD: string;
  DELIVERY_DATE: string;
  DELIVERY_TIME: string;
  SHIPPING_FEE: number;
  RECEIVER_NAME: string;
  RECEIVER_ADDRESS: string;
  RECEIVER_PHONE: string;
  IMAGE_URLS: string[];
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

export type DeliveryDriverAssignment = {
  ASSIGNMENT_ID: string;
  ORDER_ITEM_ID: string;
  ORDER_ID: string;
  DELIVERY_DRIVER_USERNAME: string;
  DELIVERY_DRIVER_NAME: string;
  QUANTITY_ASSIGNED: number;
  ASSIGNED_AT: string;
  STATUS: string;
  DELIVERY_STATUS: string;
  COMPLETED_AT: string;
  IMAGE_URLS: string[];
}

export type Attendance = {
  USERNAME: string;
  NAME: string;
  DATE: string;
  CHECK_IN_AT: string | null;
  CHECK_OUT_AT: string | null;
};

// Hasil pencarian produk Shopify (respons /api/shopify/products/search),
// dipakai field "Nama Item" di form transaksi.
export type ProductSearchResult = {
  SKU: string;
  LABEL: string;
  PRICE: number;
  CURRENCY: string;
};

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

// Item yang qty-nya belum habis diklaim kurir (ITEM_STATUS sudah READY TO
// PICKUP, siap dikirim) -- ditampilkan di tab "Order Tersedia" halaman
// kurir. Sama persis semantiknya dengan AvailableFloristItem, cuma sumber
// "siap diambil"-nya beda (READY TO PICKUP, bukan NEW ORDER/WORK IN
// PROGRESS).
export type AvailableDeliveryItem = TransactionDetail & {
  ORDER_ID: string;
  CUSTOMER_NAME: string;
  totalQty: number;
  remainingQty: number;
};

// Assignment aktif (qty tertentu dari satu item) yang sedang dipegang satu
// kurir -- ditampilkan di tab "Order Saya" halaman kurir.
export type MyDeliveryAssignment = DeliveryDriverAssignment & {
  item?: TransactionDetail & { CUSTOMER_NAME: string };
};

export type InvoiceWithDetails = Invoice & {
  details: InvoiceDetail[];
}

export type TransactionDetailWithAssignments = TransactionDetail & {
  assignments: FloristAssignment[];
  deliveryAssignments: DeliveryDriverAssignment[];
};

export type TransactionWithDetailsAndAssignments = Transaction & {
  details: TransactionDetailWithAssignments[];
};

export type OrderItemWithBilling = TransactionDetail & {
  billedQty: number;
  remainingQty: number;
};

export type TransactionWithBilling = Omit<TransactionWithDetails, 'details'> & {
  details: OrderItemWithBilling[];
  invoiceStatus: 'NOT_INVOICED' | 'PARTIAL' | 'FULLY_INVOICED';
};

export type InvoicePdfData = Invoice & {
  orderId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: {
    ITEM_NAME: string;
    QUANTITY_BILLED: number;
    PRICE_BILLED: number;
  }[];
};