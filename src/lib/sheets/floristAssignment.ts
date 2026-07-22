// src/lib/sheets/floristAssignment.ts
import { appendRow, readSheet, updateRow } from '@/lib/googleSheets';
import {FloristAssignment, TransactionDetail} from '@/types';
import { listTransactionDetails } from '@/lib/sheets/transaction';
import { listTransactionsWithDetails, updateTransactionDetailItemStatus } from '@/lib/sheets/transaction';
import { AvailableFloristItem, MyFloristAssignment } from '@/types';

const SHEET = 'Florist Assignment';

export async function listAssignments(): Promise<FloristAssignment[]> {
  return readSheet<FloristAssignment>(SHEET);
}

function forItem(assignments: FloristAssignment[], orderItemId: string) {
  return assignments.filter((a) => a.ORDER_ITEM_ID === orderItemId);
}

/** Qty yang masih "menempel" ke klaim aktif — belum dilepas (ASSIGNED atau COMPLETED). */
function claimedQuantity(assignments: FloristAssignment[]): number {
  return assignments
    .filter((a) => a.STATUS !== 'RELEASED')
    .reduce((sum, a) => sum + Number(a.QUANTITY_ASSIGNED || 0), 0);
}

function completedQuantity(assignments: FloristAssignment[]): number {
  return assignments
    .filter((a) => a.STATUS === 'COMPLETED')
    .reduce((sum, a) => sum + Number(a.QUANTITY_ASSIGNED || 0), 0);
}

/**
 * Ringkasan qty per item: total, sudah diklaim (termasuk yang lagi
 * dikerjakan), sudah selesai, dan sisa yang masih bisa diambil florist lain.
 */
export async function getItemQuantitySummary(orderItemId: string) {
  const [details, assignments] = await Promise.all([
    listTransactionDetails(),
    listAssignments(),
  ]);
  const item = details.find((d) => d.ORDER_ITEM_ID === orderItemId);
  if (!item) throw new Error('Order item tidak ditemukan');

  const itemAssignments = forItem(assignments, orderItemId);
  const totalQty = Number(item.QUANTITY || 0);
  const claimed = claimedQuantity(itemAssignments);
  const completed = completedQuantity(itemAssignments);

  return {
    totalQty,
    claimedQty: claimed,
    completedQty: completed,
    remainingQty: totalQty - claimed, // sisa yang BELUM ada yang pegang
  };
}

/** Klaim sebagian/seluruh qty suatu item. */
export async function claimItem(
  orderItemId: string,
  orderId: string,
  quantity: number,
  florist: { username: string; name: string }
): Promise<FloristAssignment> {
  if (quantity <= 0) throw new Error('Qty harus lebih dari 0');

  const { remainingQty } = await getItemQuantitySummary(orderItemId);
  if (quantity > remainingQty) {
    throw new Error(`Qty tersisa cuma ${remainingQty}, tidak bisa ambil ${quantity}`);
  }

  const assignment: FloristAssignment = {
    ASSIGNMENT_ID: `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    ORDER_ITEM_ID: orderItemId,
    ORDER_ID: orderId,
    FLORIST_USERNAME: florist.username,
    FLORIST_NAME: florist.name,
    QUANTITY_ASSIGNED: quantity,
    ASSIGNED_AT: new Date().toISOString(),
    STATUS: 'ASSIGNED',
    COMPLETED_AT: '',
  };
  await appendRow(SHEET, assignment);
  return assignment;
}

export async function releaseAssignment(assignmentId: string): Promise<boolean> {
  return updateRow(SHEET, 'ASSIGNMENT_ID', assignmentId, { STATUS: 'RELEASED' });
}

/**
 * Tandai satu assignment selesai. Kalau setelah ini total qty yang
 * COMPLETED sudah menyamai qty total item, ITEM_STATUS di Transaction
 * Detail otomatis diubah ke DONE.
 */
export async function completeAssignment(assignmentId: string): Promise<void> {
  const all = await listAssignments();
  const target = all.find((a) => a.ASSIGNMENT_ID === assignmentId);
  if (!target) throw new Error('Assignment tidak ditemukan');

  await updateRow(SHEET, 'ASSIGNMENT_ID', assignmentId, {
    STATUS: 'COMPLETED',
    COMPLETED_AT: new Date().toISOString(),
  });

  const { totalQty, completedQty } = await getItemQuantitySummary(target.ORDER_ITEM_ID);
  const nowCompleted = completedQty + Number(target.QUANTITY_ASSIGNED); // belum ter-refresh di sheet
  if (nowCompleted >= totalQty) {
    await updateTransactionDetailItemStatus(target.ORDER_ITEM_ID, { ITEM_STATUS: 'DONE' });
  }
}

export async function listAssignmentsByFlorist(
  username: string
): Promise<FloristAssignment[]> {
  const all = await listAssignments();
  return all.filter(
    (a) => a.FLORIST_USERNAME === username && a.STATUS === 'ASSIGNED'
  );
}

/** Semua item yang qty-nya belum habis diklaim (bisa diambil florist). */
export async function listAvailableItems(): Promise<AvailableFloristItem[]> {
  const [orders, assignments] = await Promise.all([
    listTransactionsWithDetails(),
    listAssignments(),
  ]);

  const claimedByItem = assignments.filter(e => {
    return !(e.STATUS === 'RELEASED')
  }).reduce((previousValue, currentValue) => {
    if (previousValue?.[currentValue.ORDER_ITEM_ID]) {
      return {
        ...previousValue,
        [currentValue.ORDER_ITEM_ID]: previousValue[currentValue.ORDER_ITEM_ID] + Number(currentValue.QUANTITY_ASSIGNED || 0)
      }
    }

    return {
      ...previousValue,
      [currentValue.ORDER_ITEM_ID]: Number(currentValue.QUANTITY_ASSIGNED || 0)
    }
  }, {} as Record<string, number>)

  const result: AvailableFloristItem[] = [];
  for (const order of orders) {
    for (const item of order.details) {
      if (item.ITEM_STATUS === 'DONE') continue;
      const totalQty = Number(item.QUANTITY || 0);
      const remainingQty = totalQty - (claimedByItem?.[item.ORDER_ITEM_ID] ?? 0);
      if (remainingQty <= 0) continue;
      result.push({
        ...item,
        ORDER_ID: order.ORDER_ID,
        CUSTOMER_NAME: order.CUSTOMER_NAME,
        totalQty,
        remainingQty,
      });
    }
  }
  return result;
}

/** Assignment aktif milik satu florist, sudah di-join dengan detail item + nama pelanggan. */
export async function listMyAssignmentsWithDetail(
  username: string
): Promise<MyFloristAssignment[]> {
  const [assignments, orders] = await Promise.all([
    listAssignments(),
    listTransactionsWithDetails(),
  ]);

  const itemById = new Map<string, TransactionDetail & { CUSTOMER_NAME: string }>();
  for (const order of orders) {
    for (const item of order.details) {
      itemById.set(item.ORDER_ITEM_ID, { ...item, CUSTOMER_NAME: order.CUSTOMER_NAME });
    }
  }

  return assignments
    .filter((a) => a.FLORIST_USERNAME === username && a.STATUS === 'ASSIGNED')
    .map((a) => ({ ...a, item: itemById.get(a.ORDER_ITEM_ID) }))
    .filter((a) => a.item);
}