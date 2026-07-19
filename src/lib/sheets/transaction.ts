import { appendRow, readSheet, updateRow } from '@/lib/googleSheets';
import {ItemStatus, Transaction, TransactionDetail, TransactionWithDetails} from '@/types';

const TRANSACTION_SHEET = 'Transaction';
const TRANSACTION_DETAIL_SHEET = 'Transaction Detail';

export async function listTransactions(): Promise<Transaction[]> {
  return readSheet<Transaction>(TRANSACTION_SHEET);
}

export async function listTransactionDetails(): Promise<TransactionDetail[]> {
  return readSheet<TransactionDetail>(TRANSACTION_DETAIL_SHEET);
}

/** Transactions joined with their line items, newest first. */
export async function listTransactionsWithDetails(): Promise<
  TransactionWithDetails[]
> {
  const [transactions, details] = await Promise.all([
    listTransactions(),
    listTransactionDetails(),
  ]);

  return transactions
    .map((t) => ({
      ...t,
      details: details.filter((d) => d.ORDER_ID === t.ORDER_ID),
    }))
    .reverse();
}

export async function getTransactionById(
  orderId: string
): Promise<TransactionWithDetails | null> {
  const all = await listTransactionsWithDetails();
  return all.find((t) => t.ORDER_ID === orderId) ?? null;
}

export async function createTransaction(
  transaction: Transaction,
  details: Omit<TransactionDetail, 'ORDER_ID'>[]
): Promise<void> {
  await appendRow(TRANSACTION_SHEET, transaction);
  for (const detail of details) {
    await appendRow(TRANSACTION_DETAIL_SHEET, {
      ...detail,
      ORDER_ID: transaction.ORDER_ID,
    });
  }
}

export async function updateTransaction(
  orderId: string,
  updates: Partial<Transaction>
): Promise<boolean> {
  return updateRow(TRANSACTION_SHEET, 'ORDER_ID', orderId, updates);
}

export async function updateTransactionDetailItemStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'ITEM_STATUS' | 'FLORIST_NAME'>
  >
): Promise<boolean> {
  return updateRow(
    TRANSACTION_DETAIL_SHEET,
    'ORDER_ITEM_ID',
    orderItemId,
    updates
  );
}

export async function updateTransactionDetailCardStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'CARD_STATUS' | 'CARD_CREATED_BY'>
  >
): Promise<boolean> {
  return updateRow(
    TRANSACTION_DETAIL_SHEET,
    'ORDER_ITEM_ID',
    orderItemId,
    updates
  );
}

export async function updateTransactionDetailDeliveryStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'DELIVERY_STATUS' | 'DELIVERY_BY'>
  >
): Promise<boolean> {
  return updateRow(
    TRANSACTION_DETAIL_SHEET,
    'ORDER_ITEM_ID',
    orderItemId,
    updates
  );
}

/**
 * Bulk-updates the ITEM_STATUS of every line item belonging to one order.
 * Used for order-level actions: Florist "Mark order done" (-> READY_TO_PICKUP)
 * and Kurir's On Delivery / Delivered / Received / Returned actions.
 */
export async function updateAllItemStatusForOrder(
  orderId: string,
  status: ItemStatus
): Promise<void> {
  const details = await listTransactionDetails();
  const orderItems = details.filter((d) => d.ORDER_ID === orderId);
  for (const item of orderItems) {
    await updateRow(TRANSACTION_DETAIL_SHEET, 'ORDER_ITEM_ID', item.ORDER_ITEM_ID, {
      ITEM_STATUS: status,
    });
  }
}

// isOrderFullyDone / filterOrdersByDeliveryStatus moved to '@/lib/statusUtils'
// (that module has no server-only imports, so it's safe to use from
// client components too — see src/app/florist/page.tsx and kurir/page.tsx).
export { isOrderFullyDone, filterOrdersByDeliveryStatus } from '@/lib/statusUtils';
