import { FloristAssignment, TransactionDetail } from '@/types';
import { listTransactionDetails } from '@/lib/db/transaction';
import { listTransactionsWithDetails, updateTransactionDetailItemStatus } from '@/lib/db/transaction';
import { AvailableFloristItem, MyFloristAssignment } from '@/types';
import {prisma} from "@/lib/prismaClient";

function toAssignment(row: any): FloristAssignment {
  return {
    ASSIGNMENT_ID: row.assignmentId,
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    FLORIST_USERNAME: row.floristUsername,
    FLORIST_NAME: row.floristName,
    QUANTITY_ASSIGNED: Number(row.quantityAssigned),
    ASSIGNED_AT:
      row.assignedAt instanceof Date ? row.assignedAt.toISOString() : row.assignedAt ?? '',
    STATUS: row.status,
    COMPLETED_AT:
      row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt ?? '',
  };
}

export async function listAssignments(): Promise<FloristAssignment[]> {
  const rows = await prisma.floristAssignment.findMany();
  return rows.map(toAssignment);
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

  const created = await prisma.floristAssignment.create({
    data: {
      assignmentId: `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      orderItemId,
      orderId,
      floristUsername: florist.username,
      floristName: florist.name,
      quantityAssigned: quantity,
      status: 'ASSIGNED',
    },
  });

  return toAssignment(created);
}

export async function releaseAssignment(assignmentId: string): Promise<boolean> {
  try {
    await prisma.floristAssignment.update({
      where: { assignmentId },
      data: { status: 'RELEASED' },
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false;
    throw err;
  }
}

/**
 * Tandai satu assignment selesai. Kalau setelah ini total qty yang
 * COMPLETED sudah menyamai qty total item, ITEM_STATUS di Transaction
 * Detail otomatis diubah ke DONE.
 */
export async function completeAssignment(assignmentId: string): Promise<void> {
  const target = await prisma.floristAssignment.findUnique({
    where: { assignmentId },
  });
  if (!target) throw new Error('Assignment tidak ditemukan');

  await prisma.floristAssignment.update({
    where: { assignmentId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  const { totalQty, completedQty } = await getItemQuantitySummary(target.orderItemId);
  const nowCompleted = completedQty + Number(target.quantityAssigned); // belum ter-refresh di atas
  if (nowCompleted >= totalQty) {
    await updateTransactionDetailItemStatus(target.orderItemId, { ITEM_STATUS: 'DONE' });
  }
}

export async function listAssignmentsByFlorist(
  username: string
): Promise<FloristAssignment[]> {
  const rows = await prisma.floristAssignment.findMany({
    where: { floristUsername: username, status: 'ASSIGNED' },
  });
  return rows.map(toAssignment);
}

/** Semua item yang qty-nya belum habis diklaim (bisa diambil florist). */
export async function listAvailableItems(): Promise<AvailableFloristItem[]> {
  const [orders, assignments] = await Promise.all([
    listTransactionsWithDetails(),
    listAssignments(),
  ]);

  const claimedByItem = assignments
    .filter((e) => e.STATUS !== 'RELEASED')
    .reduce((acc, cur) => {
      acc[cur.ORDER_ITEM_ID] = (acc[cur.ORDER_ITEM_ID] ?? 0) + Number(cur.QUANTITY_ASSIGNED || 0);
      return acc;
    }, {} as Record<string, number>);

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
    .filter((a) => !!a.item);
}