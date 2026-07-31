import 'server-only';
import {AvailableDeliveryItem, DeliveryDriverAssignment, MyDeliveryAssignment, TransactionDetail} from '@/types';
import {toTransactionDetail} from '@/lib/db/transaction';
import {prisma} from "@/lib/prismaClient";
import {Prisma} from "@/generated/prisma/client";
import {DeliveryDriverAssignmentModel} from "@/generated/prisma/models/DeliveryDriverAssignment";
import {generateDeliveryDriverAssignmentId} from "@/lib/generateId";
import serverDayJs from "@/lib/server.dayjs";

// Status delivery yang dianggap "selesai" -- begitu tercapai, assignment
// otomatis ditandai COMPLETED (analog completeAssignment di
// floristAssignment.ts, tapi triggernya deliveryStatus, bukan qty).
const TERMINAL_DELIVERY_STATUSES = ['RECEIVED', 'RETURNED'];

function toAssignment(row: DeliveryDriverAssignmentModel): DeliveryDriverAssignment {
  return {
    ASSIGNMENT_ID: row.assignmentId,
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    DELIVERY_DRIVER_USERNAME: row.deliveryDriverUsername,
    DELIVERY_DRIVER_NAME: row.deliveryDriverName,
    QUANTITY_ASSIGNED: row.quantityAssigned.toNumber(),
    ASSIGNED_AT: row.assignedAt ? serverDayJs(row.assignedAt).format("YYYY-MM-DD HH:mm:ss") : "",
    STATUS: row.status,
    DELIVERY_STATUS: row.deliveryStatus ?? "",
    COMPLETED_AT: row.completedAt ? serverDayJs(row.completedAt).format("YYYY-MM-DD HH:mm:ss") : "",
    IMAGE_URLS: row.imageUrls ?? [],
  };
}

export async function listAssignments(): Promise<DeliveryDriverAssignment[]> {
  const rows = await prisma.deliveryDriverAssignment.findMany();
  return rows.map(toAssignment);
}

/**
 * Kunci baris TransactionDetail (SELECT ... FOR UPDATE) lalu hitung ulang
 * ringkasan qty-nya di dalam transaction yang sama -- sama alasannya dengan
 * lockAndSummarizeItem di floristAssignment.ts.
 */
async function lockAndSummarizeItem(tx: Prisma.TransactionClient, orderItemId: string) {
  await tx.$queryRaw`SELECT order_item_id FROM transaction_detail WHERE order_item_id = ${orderItemId} FOR UPDATE`;

  const item = await tx.transactionDetail.findUnique({ where: { orderItemId } });
  if (!item) throw new Error('Order item tidak ditemukan');

  const assignments = await tx.deliveryDriverAssignment.findMany({ where: { orderItemId } });
  const totalQty = Number(item.quantity || 0);
  const claimedQty = assignments
    .filter((a) => a.status !== 'RELEASED')
    .reduce((sum, a) => sum + a.quantityAssigned.toNumber(), 0);

  return { item, totalQty, claimedQty, remainingQty: totalQty - claimedQty };
}

/**
 * Klaim sebagian/seluruh qty suatu item -- item harus sudah DONE (florist
 * selesai) sebelum bisa diambil kurir.
 */
export async function claimItem(
  orderItemId: string,
  orderId: string,
  quantity: number,
  deliveryDriver: { username: string; name: string }
): Promise<DeliveryDriverAssignment> {
  if (quantity <= 0) throw new Error('Qty harus lebih dari 0');

  const created = await prisma.$transaction(async (tx) => {
    const { item, remainingQty } = await lockAndSummarizeItem(tx, orderItemId);

    if (item.itemStatus !== 'DONE') {
      throw new Error('Item belum selesai dikerjakan florist');
    }
    if (quantity > remainingQty) {
      throw new Error(`Qty tersisa cuma ${remainingQty}, tidak bisa ambil ${quantity}`);
    }

    return tx.deliveryDriverAssignment.create({
      data: {
        assignmentId: generateDeliveryDriverAssignmentId(),
        orderItemId,
        orderId,
        deliveryDriverUsername: deliveryDriver.username,
        deliveryDriverName: deliveryDriver.name,
        quantityAssigned: quantity,
        status: 'ASSIGNED',
        deliveryStatus: 'PICKUP',
      },
    });
  });

  return toAssignment(created);
}

/** Lepas satu assignment, supaya qty-nya bisa diambil kurir lain lagi. */
export async function releaseAssignment(assignmentId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.deliveryDriverAssignment.findUnique({ where: { assignmentId } });
    if (!target) return false;

    // Kunci baris item duluan -- biar kurir/admin lain yang lagi
    // claim/release/advance di item yang sama nunggu, bukan baca claimedQty
    // yang belum ke-update punya kita.
    await lockAndSummarizeItem(tx, target.orderItemId);

    await tx.deliveryDriverAssignment.update({
      where: { assignmentId },
      data: { status: 'RELEASED' },
    });

    return true;
  });
}

/**
 * Majukan status delivery satu assignment (harus milik kurir yang minta).
 * Foto bukti WAJIB tepat 1 di setiap perubahan status -- lihat validasi
 * imageUrls di bawah (juga divalidasi lagi di route.ts sebelum panggil ini,
 * tapi dicek ulang di sini supaya pemanggil lain tidak bisa melewatinya).
 * Kalau status barunya "terminal" (RECEIVED/RETURNED), assignment sekalian
 * ditandai COMPLETED.
 */
export async function advanceAssignmentDeliveryStatus(
  assignmentId: string,
  deliveryDriverUsername: string,
  deliveryStatus: string,
  imageUrls: string[]
): Promise<boolean> {
  if (!imageUrls || imageUrls.length !== 1) {
    throw new Error('Wajib upload tepat 1 foto bukti sebelum ganti status');
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.deliveryDriverAssignment.findUnique({ where: { assignmentId } });
    if (!target) return false;
    if (target.deliveryDriverUsername !== deliveryDriverUsername || target.status !== 'ASSIGNED') {
      return false;
    }

    await lockAndSummarizeItem(tx, target.orderItemId);

    const isTerminal = TERMINAL_DELIVERY_STATUSES.includes(deliveryStatus);

    await tx.deliveryDriverAssignment.update({
      where: { assignmentId },
      data: {
        deliveryStatus,
        imageUrls: [...(target.imageUrls ?? []), ...imageUrls],
        ...(isTerminal ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });

    return true;
  });
}

/** Tambah foto bukti kirim ke satu assignment (harus milik kurir yang minta). */
export async function addProofImages(
  assignmentId: string,
  deliveryDriverUsername: string,
  urls: string[]
): Promise<boolean> {
  if (urls.length === 0) return true;

  const target = await prisma.deliveryDriverAssignment.findUnique({ where: { assignmentId } });
  if (!target || target.deliveryDriverUsername !== deliveryDriverUsername || target.status !== 'ASSIGNED') {
    return false;
  }

  await prisma.deliveryDriverAssignment.update({
    where: { assignmentId },
    data: { imageUrls: [...(target.imageUrls ?? []), ...urls] },
  });

  return true;
}

/**
 * Semua item yang statusnya DONE (siap dikirim) dan qty-nya belum habis
 * diklaim kurir, buat "load more" -- lihat listAvailableItemsPaged di
 * floristAssignment.ts untuk penjelasan pattern query-nya.
 */
export async function listAvailableItemsPaged(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ items: AvailableDeliveryItem[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const rows = await prisma.transactionDetail.findMany({
    where: { itemStatus: 'DONE' },
    orderBy: [{ transaction: { createdAt: 'desc' } }, { orderItemId: 'asc' }],
    include: {
      transaction: true,
      deliveryDriverAssignments: { where: { status: { not: 'RELEASED' } } },
    },
  });

  const candidates = rows
    .map((row) => {
      const totalQty = Number(row.quantity || 0);
      const claimedQty = row.deliveryDriverAssignments.reduce(
        (sum, a) => sum + a.quantityAssigned.toNumber(),
        0
      );
      return { row, totalQty, remainingQty: totalQty - claimedQty };
    })
    .filter((c) => c.remainingQty > 0);

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const paged = candidates.slice(start, start + pageSize);

  const items: AvailableDeliveryItem[] = paged.map(({ row, totalQty, remainingQty }) => ({
    ...toTransactionDetail(row),
    ORDER_ID: row.orderId,
    CUSTOMER_NAME: row.transaction.customerName,
    totalQty,
    remainingQty,
  }));

  return { items, total };
}

/**
 * Assignment aktif milik satu kurir, di-join dengan detail item + nama
 * pelanggan -- lihat listMyAssignmentsWithDetailPaged di
 * floristAssignment.ts untuk penjelasan pattern query-nya.
 */
export async function listMyAssignmentsWithDetailPaged(
  username: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<{ assignments: MyDeliveryAssignment[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const where = { deliveryDriverUsername: username, status: 'ASSIGNED' };

  const [rows, total] = await Promise.all([
    prisma.deliveryDriverAssignment.findMany({
      where,
      orderBy: { assignedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.deliveryDriverAssignment.count({ where }),
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

  const assignments: MyDeliveryAssignment[] = rows
    .map((r) => ({ ...toAssignment(r), item: itemById.get(r.orderItemId) }))
    .filter((a) => !!a.item);

  return { assignments, total };
}
