import { prisma } from '@/lib/prismaClient';
import { Transaction, TransactionDetail, TransactionWithDetails } from '@/types';
import dayjs from "dayjs";

// ---- Prisma (camelCase) <-> App types (SNAKE_CASE) mappers ----

function toTransaction(row: any): Transaction {
  return {
    ORDER_ID: row.orderId,
    ORDER_SOURCE: row.orderSource,
    SALES_NAME: row.salesName,
    CUSTOMER_NAME: row.customerName,
    CUSTOMER_ADDRESS: row.customerAddress,
    CUSTOMER_PHONE: row.customerPhone,
    CUSTOMER_EMAIL: row.customerEmail,
    GRAND_TOTAL: Number(row.grandTotal),
    DOWN_PAYMENT: Number(row.downPayment),
    REMAINING_BALANCE: Number(row.remainingBalance),
    PAYMENT_METHOD: row.paymentMethod,
  };
}

function toTransactionDetail(row: any): TransactionDetail {
  return {
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    ITEM_NAME: row.itemName,
    QUANTITY: Number(row.quantity),
    UNIT_PRICE: Number(row.unitPrice),
    CURRENCY: row.currency,
    CURRENCY_RATE: Number(row.currencyRate),
    CUSTOM_NOTES: row.customNotes,
    SUBTOTAL: Number(row.subtotal),
    ITEM_STATUS: row.itemStatus,
    CARD_TO: row.cardTo,
    CARD_MESSAGE: row.cardMessage,
    CARD_FROM: row.cardFrom,
    CARD_NOTE: row.cardNote,
    CARD_CREATED_BY: row.cardCreatedBy,
    CARD_STATUS: row.cardStatus,
    DELIVERY_BY: row.deliveryBy,
    DELIVERY_METHOD: row.deliveryMethod,
    DELIVERY_DATE: row.deliveryDate,
    DELIVERY_TIME: row.deliveryTime,
    DELIVERY_STATUS: row.deliveryStatus,
    SHIPPING_FEE: Number(row.shippingFee),
    RECEIVER_NAME: row.receiverName,
    RECEIVER_ADDRESS: row.receiverAddress,
    RECEIVER_PHONE: row.receiverPhone,
  };
}

function fromTransaction(t: Transaction) {
  return {
    orderId: t.ORDER_ID,
    orderSource: t.ORDER_SOURCE,
    salesName: t.SALES_NAME,
    customerName: t.CUSTOMER_NAME,
    customerAddress: t.CUSTOMER_ADDRESS,
    customerPhone: t.CUSTOMER_PHONE,
    customerEmail: t.CUSTOMER_EMAIL,
    grandTotal: t.GRAND_TOTAL,
    downPayment: t.DOWN_PAYMENT,
    remainingBalance: t.REMAINING_BALANCE,
    paymentMethod: t.PAYMENT_METHOD,
  };
}

function fromTransactionDetail(d: Omit<TransactionDetail, 'ORDER_ID'>) {
  return {
    orderItemId: d.ORDER_ITEM_ID,
    itemName: d.ITEM_NAME,
    quantity: d.QUANTITY,
    unitPrice: d.UNIT_PRICE,
    currency: d.CURRENCY,
    currencyRate: d.CURRENCY_RATE,
    customNotes: d.CUSTOM_NOTES,
    subtotal: d.SUBTOTAL,
    itemStatus: d.ITEM_STATUS,
    cardTo: d.CARD_TO,
    cardMessage: d.CARD_MESSAGE,
    cardFrom: d.CARD_FROM,
    cardNote: d.CARD_NOTE,
    cardCreatedBy: d.CARD_CREATED_BY,
    cardStatus: d.CARD_STATUS,
    deliveryBy: d.DELIVERY_BY,
    deliveryMethod: d.DELIVERY_METHOD,
    deliveryDate: d.DELIVERY_DATE ? dayjs(d.DELIVERY_DATE).toDate() : null,
    deliveryTime: d.DELIVERY_TIME ? dayjs(`${d.DELIVERY_DATE ? d.DELIVERY_DATE : dayjs().format("YYYY-MM-DD")} ${d.DELIVERY_TIME}`).toDate() : null,
    deliveryStatus: d.DELIVERY_STATUS,
    shippingFee: d.SHIPPING_FEE,
    receiverName: d.RECEIVER_NAME,
    receiverAddress: d.RECEIVER_ADDRESS,
    receiverPhone: d.RECEIVER_PHONE,
  };
}

function fromTransactionUpdates(updates: Partial<Transaction>) {
  const data: Record<string, unknown> = {};
  if (updates.ORDER_SOURCE !== undefined) data.orderSource = updates.ORDER_SOURCE;
  if (updates.SALES_NAME !== undefined) data.salesName = updates.SALES_NAME;
  if (updates.CUSTOMER_NAME !== undefined) data.customerName = updates.CUSTOMER_NAME;
  if (updates.CUSTOMER_ADDRESS !== undefined) data.customerAddress = updates.CUSTOMER_ADDRESS;
  if (updates.CUSTOMER_PHONE !== undefined) data.customerPhone = updates.CUSTOMER_PHONE;
  if (updates.CUSTOMER_EMAIL !== undefined) data.customerEmail = updates.CUSTOMER_EMAIL;
  if (updates.GRAND_TOTAL !== undefined) data.grandTotal = updates.GRAND_TOTAL;
  if (updates.DOWN_PAYMENT !== undefined) data.downPayment = updates.DOWN_PAYMENT;
  if (updates.REMAINING_BALANCE !== undefined) data.remainingBalance = updates.REMAINING_BALANCE;
  if (updates.PAYMENT_METHOD !== undefined) data.paymentMethod = updates.PAYMENT_METHOD;
  return data;
}

// ---- Public API (signature identik dengan versi Google Sheets) ----

export async function listTransactions(): Promise<Transaction[]> {
  const rows = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toTransaction);
}

export async function listTransactionDetails(): Promise<TransactionDetail[]> {
  const rows = await prisma.transactionDetail.findMany();
  return rows.map(toTransactionDetail);
}

/** Transactions joined with their line items, newest first. */
export async function listTransactionsWithDetails(): Promise<
  TransactionWithDetails[]
> {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' }, // newest first, dulu didapat dari .reverse()
    include: { details: true },
  });

  return transactions.map((t) => ({
    ...toTransaction(t),
    details: t.details.map(toTransactionDetail),
  }));
}

export async function getTransactionById(
  orderId: string
): Promise<TransactionWithDetails | null> {
  const t = await prisma.transaction.findUnique({
    where: { orderId },
    include: { details: true },
  });
  if (!t) return null;
  return { ...toTransaction(t), details: t.details.map(toTransactionDetail) };
}

export async function createTransaction(
  transaction: Transaction,
  details: Omit<TransactionDetail, 'ORDER_ID'>[]
): Promise<void> {
  await prisma.transaction.create({
    data: {
      ...fromTransaction(transaction),
      details: {
        create: details.map(fromTransactionDetail),
      },
    },
  });
}

export async function updateTransaction(
  orderId: string,
  updates: Partial<Transaction>
): Promise<boolean> {
  try {
    await prisma.transaction.update({
      where: { orderId },
      data: fromTransactionUpdates(updates),
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false;
    throw err;
  }
}

export async function updateTransactionDetailItemStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'ITEM_STATUS'>
  >
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (updates.ITEM_STATUS !== undefined) data.itemStatus = updates.ITEM_STATUS;
  try {
    await prisma.transactionDetail.update({ where: { orderItemId }, data });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false;
    throw err;
  }
}

export async function updateTransactionDetailCardStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'CARD_STATUS' | 'CARD_CREATED_BY'>
  >
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (updates.CARD_STATUS !== undefined) data.cardStatus = updates.CARD_STATUS;
  if (updates.CARD_CREATED_BY !== undefined) data.cardCreatedBy = updates.CARD_CREATED_BY;
  try {
    await prisma.transactionDetail.update({ where: { orderItemId }, data });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false;
    throw err;
  }
}

export async function updateTransactionDetailDeliveryStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'DELIVERY_STATUS' | 'DELIVERY_BY'>
  >
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (updates.DELIVERY_STATUS !== undefined) data.deliveryStatus = updates.DELIVERY_STATUS;
  if (updates.DELIVERY_BY !== undefined) data.deliveryBy = updates.DELIVERY_BY;
  try {
    await prisma.transactionDetail.update({ where: { orderItemId }, data });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false;
    throw err;
  }
}

/**
 * Bulk-updates the ITEM_STATUS of every line item belonging to one order.
 * Used for order-level actions: Florist "Mark order done" (-> READY_TO_PICKUP)
 * and Kurir's On Delivery / Delivered / Received / Returned actions.
 */
export async function updateAllItemStatusForOrder(
  orderId: string,
  itemStatus: string
): Promise<void> {
  await prisma.transactionDetail.updateMany({
    where: { orderId },
    data: { itemStatus },
  });
}

// isOrderFullyDone / filterOrdersByDeliveryStatus moved to '@/lib/statusUtils'
// (that module has no server-only imports, so it's safe to use from
// client components too — see src/app/florist/page.tsx and kurir/page.tsx).
export { isOrderFullyDone, filterOrdersByDeliveryStatus } from '@/lib/statusUtils';