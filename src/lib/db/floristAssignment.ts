import 'server-only';
import {AvailableFloristItem, FloristAssignment, MyFloristAssignment, TransactionDetail} from '@/types';
import {
  listTransactionDetails,
  toTransactionDetail,
} from '@/lib/db/transaction';
import {prisma} from "@/lib/prismaClient";
import {Prisma} from "@/generated/prisma/client";
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

/**
 * Kunci baris TransactionDetail (SELECT ... FOR UPDATE) lalu hitung ulang
 * ringkasan qty-nya di dalam transaction yang sama. Dipakai buat operasi
 * yang mutusin sesuatu berdasarkan qty lalu langsung nulis (claim,
 * complete) -- supaya dua request yang balapan di item yang sama nggak
 * baca angka yang sama-sama basi. Request kedua otomatis nunggu di baris
 * FOR UPDATE sampai transaction pertama commit, baru lanjut baca angka
 * yang udah ke-update.
 */
async function lockAndSummarizeItem(tx: Prisma.TransactionClient, orderItemId: string) {
  await tx.$queryRaw`SELECT order_item_id FROM transaction_detail WHERE order_item_id = ${orderItemId} FOR UPDATE`;

  const item = await tx.transactionDetail.findUnique({ where: { orderItemId } });
  if (!item) throw new Error('Order item tidak ditemukan');

  const assignments = await tx.floristAssignment.findMany({ where: { orderItemId } });
  const totalQty = Number(item.quantity || 0);
  const claimedQty = assignments
    .filter((a) => a.status !== 'RELEASED')
    .reduce((sum, a) => sum + a.quantityAssigned.toNumber(), 0);
  const completedQty = assignments
    .filter((a) => a.status === 'COMPLETED')
    .reduce((sum, a) => sum + a.quantityAssigned.toNumber(), 0);

  return { item, totalQty, claimedQty, completedQty, remainingQty: totalQty - claimedQty };
}

/** Klaim sebagian/seluruh qty suatu item. */
export async function claimItem(
  orderItemId: string,
  orderId: string,
  quantity: number,
  florist: { username: string; name: string }
): Promise<FloristAssignment> {
  if (quantity <= 0) throw new Error('Qty harus lebih dari 0');

  const created = await prisma.$transaction(async (tx) => {
    const { item, remainingQty } = await lockAndSummarizeItem(tx, orderItemId);

    if (quantity > remainingQty) {
      throw new Error(`Qty tersisa cuma ${remainingQty}, tidak bisa ambil ${quantity}`);
    }

    const row = await tx.floristAssignment.create({
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

    if (item.itemStatus === 'NEW ORDER') {
      await tx.transactionDetail.update({
        where: { orderItemId },
        data: { itemStatus: 'WORK IN PROGRESS' },
      });
    }

    return row;
  });

  return toAssignment(created);
}

export async function releaseAssignment(assignmentId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.floristAssignment.findUnique({ where: { assignmentId } });
    if (!target) return false;

    // Kunci baris item duluan -- biar florist/admin lain yang lagi
    // claim/release/complete di item yang sama nunggu, bukan baca
    // claimedQty yang belum ke-update punya kita.
    await lockAndSummarizeItem(tx, target.orderItemId);

    await tx.floristAssignment.update({
      where: { assignmentId },
      data: { status: 'RELEASED' },
    });

    // Kalau sekarang tidak ada assignment aktif (ASSIGNED/COMPLETED) yang
    // tersisa untuk item ini, balikin status ke NEW ORDER supaya florist
    // lain tahu item ini kosong lagi (bukan "masih diproses").
    const { claimedQty } = await lockAndSummarizeItem(tx, target.orderItemId);
    if (claimedQty === 0) {
      await tx.transactionDetail.update({
        where: { orderItemId: target.orderItemId },
        data: { itemStatus: 'NEW ORDER' },
      });
    }

    return true;
  });
}

/**
 * Tandai satu assignment selesai. Kalau setelah ini total qty yang
 * COMPLETED sudah menyamai qty total item, ITEM_STATUS di Transaction
 * Detail otomatis diubah ke READY TO PICKUP.
 */
export async function completeAssignment(assignmentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.floristAssignment.findUnique({ where: { assignmentId } });
    if (!target) throw new Error('Assignment tidak ditemukan');

    // Kunci baris item duluan, SEBELUM update status assignment -- biar
    // florist lain yang lagi nyelesain assignment lain di item yang sama
    // nunggu di sini, bukan baca completedQty yang belum ke-update punya kita.
    await lockAndSummarizeItem(tx, target.orderItemId);

    await tx.floristAssignment.update({
      where: { assignmentId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const { totalQty, completedQty } = await lockAndSummarizeItem(tx, target.orderItemId);
    if (completedQty >= totalQty) {
      // itemStatus: 'READY TO PICKUP' menandai item siap diambil kurir --
      // lihat listAvailableItemsPaged di deliveryDriverAssignment.ts, yang
      // menggantikan deliveryStatus: 'PICKUP' versi lama (field itu sekarang
      // milik DeliveryDriverAssignment, bukan TransactionDetail).
      await tx.transactionDetail.update({
        where: { orderItemId: target.orderItemId },
        data: { itemStatus: 'READY TO PICKUP' },
      });
    }
  });
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
 * (yang isinya mayoritas sudah lewat tahap florist) kayak versi lama.
 *
 * Query langsung ke TransactionDetail (bukan lewat listTransactionsWithDetails())
 * dan filter ITEM_STATUS ke tahap florist saja (NEW ORDER / WORK IN PROGRESS)
 * di level DB dulu -- begitu READY TO PICKUP/ON DELIVERY/DONE, item itu sudah
 * lewat tahap florist. remainingQty tetap dihitung di memori dari assignment
 * aktif per item, karena itu bukan kolom biasa -- tapi himpunan kandidatnya
 * jauh lebih kecil daripada "semua transaksi".
 */
export async function listAvailableItemsPaged(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ items: AvailableFloristItem[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const rows = await prisma.transactionDetail.findMany({
    where: { itemStatus: { in: ['NEW ORDER', 'WORK IN PROGRESS'] } },
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
 * Semua assignment aktif milik satu florist, di-join dengan detail item +
 * nama pelanggan. Tidak dipaginasi -- daftar "punya saya" biasanya kecil
 * (yang lagi dikerjakan florist itu sendiri), jadi dikirim sekaligus.
 * Paginasi cuma dipakai di listAvailableItemsPaged (daftar "tersedia" yang
 * bisa jauh lebih besar).
 */
export async function listMyAssignmentsWithDetail(
  username: string
): Promise<MyFloristAssignment[]> {
  const where = { floristUsername: username, status: 'ASSIGNED' };

  const rows = await prisma.floristAssignment.findMany({
    where,
    orderBy: { assignedAt: 'desc' },
  });

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

  return rows
    .map((r) => ({ ...toAssignment(r), item: itemById.get(r.orderItemId) }))
    .filter((a) => !!a.item);
}