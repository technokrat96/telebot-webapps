import 'server-only';
import {AvailableFloristItem, FloristAssignment, MyFloristAssignment, TransactionDetail} from '@/types';
import {
  listTransactionDetails,
  toTransactionDetail,
  updateTransactionDetailItemStatus
} from '@/lib/db/transaction';
import {prisma} from "@/lib/prismaClient";
import {FloristAssignmentModel} from "@/generated/prisma/models/FloristAssignment";
import {generateFloristAssignmentId} from "@/lib/generateId";
import serverDayJs from "@/lib/server.dayjs";

function toAssignment(row: FloristAssignmentModel): FloristAssignment {
  return {
    ASSIGNMENT_ID: row.assignmentId,
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    FLORIST_USERNAME: row.floristUsername,
    FLORIST_NAME: row.floristName,
    QUANTITY_ASSIGNED: row.quantityAssigned.toNumber(),
    ASSIGNED_AT: row.assignedAt ? serverDayJs(row.assignedAt).format("YYYY-MM-DD HH:mm:ss") : "",
    STATUS: row.status,
    COMPLETED_AT: row.completedAt ? serverDayJs(row.completedAt).format("YYYY-MM-DD HH:mm:ss") : "",
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
      assignmentId: generateFloristAssignmentId(),
      orderItemId,
      orderId,
      floristUsername: florist.username,
      floristName: florist.name,
      quantityAssigned: quantity,
      status: 'ASSIGNED',
    },
  });

  const item = await prisma.transactionDetail.findUnique({ where: { orderItemId } });
  if (item?.itemStatus === 'NEW ORDER') {
    await updateTransactionDetailItemStatus(orderItemId, { ITEM_STATUS: 'ON PROGRESS' });
  }

  return toAssignment(created);
}

export async function releaseAssignment(assignmentId: string): Promise<boolean> {
  const target = await prisma.floristAssignment.findUnique({ where: { assignmentId } });
  if (!target) return false;

  await prisma.floristAssignment.update({
    where: { assignmentId },
    data: { status: 'RELEASED' },
  });

  // Kalau sekarang tidak ada assignment aktif (ASSIGNED/COMPLETED) yang
  // tersisa untuk item ini, balikin status ke NEW ORDER supaya florist
  // lain tahu item ini kosong lagi (bukan "masih diproses").
  const { claimedQty } = await getItemQuantitySummary(target.orderItemId);
  if (claimedQty === 0) {
    await updateTransactionDetailItemStatus(target.orderItemId, { ITEM_STATUS: 'NEW ORDER' });
  }

  return true;
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
  if (completedQty >= totalQty) {
    await updateTransactionDetailItemStatus(target.orderItemId, { ITEM_STATUS: 'DONE', DELIVERY_STATUS: 'PICKUP' });
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

/**
 * Semua item yang qty-nya belum habis diklaim (bisa diambil florist), buat
 * "load more" -- jadi tidak lagi nge-load SEMUA transaksi dari awal waktu
 * (yang isinya mayoritas sudah DONE) kayak versi lama.
 *
 * Query langsung ke TransactionDetail (bukan lewat listTransactionsWithDetails())
 * dan filter ITEM_STATUS != DONE di level DB dulu. remainingQty tetap dihitung
 * di memori dari assignment aktif per item, karena itu bukan kolom biasa --
 * tapi himpunan kandidatnya jauh lebih kecil daripada "semua transaksi".
 */
export async function listAvailableItemsPaged(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ items: AvailableFloristItem[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const rows = await prisma.transactionDetail.findMany({
    where: { itemStatus: { not: 'DONE' } },
    orderBy: [{ transaction: { createdAt: 'desc' } }, { orderItemId: 'asc' }],
    include: {
      transaction: true,
      floristAssignments: { where: { status: { not: 'RELEASED' } } },
    },
  });

  const candidates = rows
    .map((row) => {
      const totalQty = Number(row.quantity || 0);
      const claimedQty = row.floristAssignments.reduce(
        (sum, a) => sum + a.quantityAssigned.toNumber(),
        0
      );
      return { row, totalQty, remainingQty: totalQty - claimedQty };
    })
    .filter((c) => c.remainingQty > 0);

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const paged = candidates.slice(start, start + pageSize);

  const items: AvailableFloristItem[] = paged.map(({ row, totalQty, remainingQty }) => ({
    ...toTransactionDetail(row),
    ORDER_ID: row.orderId,
    CUSTOMER_NAME: row.transaction.customerName,
    totalQty,
    remainingQty,
  }));

  return { items, total };
}

/**
 * Assignment aktif milik satu florist, di-join dengan detail item + nama
 * pelanggan. Query utamanya (FloristAssignment where florist+ASSIGNED) sudah
 * bisa di-`skip`/`take` langsung di DB -- cuma join detail item yang
 * dilakukan per halaman (bukan semua transaksi kayak sebelumnya).
 */
export async function listMyAssignmentsWithDetailPaged(
  username: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ assignments: MyFloristAssignment[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const where = { floristUsername: username, status: 'ASSIGNED' };

  const [rows, total] = await Promise.all([
    prisma.floristAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.floristAssignment.count({ where }),
  ]);

  const orderItemIds = rows.map((r) => r.orderItemId);
  const details = orderItemIds.length
    ? await prisma.transactionDetail.findMany({
        where: { orderItemId: { in: orderItemIds } },
        include: { transaction: true },
      })
    : [];
  const itemById = new Map<string, TransactionDetail & { CUSTOMER_NAME: string }>(
    details.map((d) => [d.orderItemId, { ...toTransactionDetail(d), CUSTOMER_NAME: d.transaction.customerName }])
  );

  const assignments: MyFloristAssignment[] = rows
    .map((r) => ({ ...toAssignment(r), item: itemById.get(r.orderItemId) }))
    .filter((a) => !!a.item);

  return { assignments, total };
}