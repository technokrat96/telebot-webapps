import 'server-only';
import {prisma} from '@/lib/prismaClient';
import {
  FloristAssignment,
  Transaction,
  TransactionDetail,
  TransactionWithDetails,
  TransactionWithDetailsAndAssignments
} from '@/types';
import {TransactionModel} from "@/generated/prisma/models/Transaction";
import {TransactionDetailModel} from "@/generated/prisma/models/TransactionDetail";
import {FloristAssignmentModel} from "@/generated/prisma/models/FloristAssignment";
import {Decimal} from "@prisma/client-runtime-utils";
import {generateOrderId, generateOrderItemId} from "@/lib/generateId";
import serverDayJs from "@/lib/server.dayjs";

function toTransaction(row: TransactionModel): Transaction {
  return {
    ORDER_ID: row.orderId,
    ORDER_SOURCE: row.orderSource ?? "",
    SALES_NAME: row.salesName ?? "",
    CUSTOMER_NAME: row.customerName,
    CUSTOMER_ADDRESS: row.customerAddress ?? "",
    CUSTOMER_PHONE: row.customerPhone ?? "",
    CUSTOMER_EMAIL: row.customerEmail ?? "",
    GRAND_TOTAL: row.grandTotal.toNumber(),
    DOWN_PAYMENT: row.downPayment.toNumber(),
    REMAINING_BALANCE: row.remainingBalance.toNumber(),
    PAYMENT_METHOD: row.paymentMethod ?? "",
  };
}

function toTransactionDetail(row: TransactionDetailModel): TransactionDetail {
  return {
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    ITEM_NAME: row.itemName,
    QUANTITY: Number(row.quantity),
    UNIT_PRICE: Number(row.unitPrice),
    CURRENCY: row.currency,
    CURRENCY_RATE: Number(row.currencyRate),
    CUSTOM_NOTES: row.customNotes ?? "",
    SUBTOTAL: Number(row.subtotal),
    ITEM_STATUS: row.itemStatus,
    CARD_TO: row.cardTo ?? "",
    CARD_MESSAGE: row.cardMessage ?? "",
    CARD_FROM: row.cardFrom ?? "",
    CARD_NOTE: row.cardNote ?? "",
    CARD_CREATED_BY: row.cardCreatedBy ?? "",
    CARD_STATUS: row.cardStatus ?? "",
    DELIVERY_BY: row.deliveryBy ?? "",
    DELIVERY_METHOD: row.deliveryMethod ?? "",
    DELIVERY_DATE: row.deliveryDate ? serverDayJs(row.deliveryDate).format("YYYY-MM-DD HH:mm:ss") : "",
    DELIVERY_TIME: row.deliveryTime ? serverDayJs(row.deliveryTime).format("YYYY-MM-DD HH:mm:ss") : "",
    DELIVERY_STATUS: row.deliveryStatus ?? "",
    SHIPPING_FEE: row.shippingFee.toNumber(),
    RECEIVER_NAME: row.receiverName ?? "",
    RECEIVER_ADDRESS: row.receiverAddress ?? "",
    RECEIVER_PHONE: row.receiverPhone ?? "",
    IMAGE_URLS: row.imageUrls ?? [],
  };
}

function toAssignmentLocal(row: FloristAssignmentModel): FloristAssignment {
  return {
    ASSIGNMENT_ID: row.assignmentId,
    ORDER_ITEM_ID: row.orderItemId,
    ORDER_ID: row.orderId,
    FLORIST_USERNAME: row.floristUsername,
    FLORIST_NAME: row.floristName,
    QUANTITY_ASSIGNED: Number(row.quantityAssigned),
    ASSIGNED_AT: row.assignedAt ? serverDayJs(row.assignedAt).format("YYYY-MM-DD HH:mm:ss") : "",
    STATUS: row.status,
    COMPLETED_AT: row.completedAt ? serverDayJs(row.completedAt).format("YYYY-MM-DD HH:mm:ss") : "",
  };
}

function fromTransaction(t: Omit<Transaction, 'ORDER_ID'>): Omit<TransactionModel, "orderId" | "createdAt"> {
  return {
    orderSource: t.ORDER_SOURCE,
    salesName: t.SALES_NAME,
    customerName: t.CUSTOMER_NAME,
    customerAddress: t.CUSTOMER_ADDRESS,
    customerPhone: t.CUSTOMER_PHONE,
    customerEmail: t.CUSTOMER_EMAIL,
    grandTotal: new Decimal(t.GRAND_TOTAL),
    downPayment: new Decimal(t.DOWN_PAYMENT),
    remainingBalance: new Decimal(t.REMAINING_BALANCE),
    paymentMethod: t.PAYMENT_METHOD,
  };
}

function fromTransactionDetail(d: Omit<TransactionDetail, 'ORDER_ID' | 'ORDER_ITEM_ID'>): Omit<TransactionDetailModel, "orderId" | "orderItemId"> {
  return {
    itemName: d.ITEM_NAME,
    quantity: Number(d.QUANTITY || 0),
    unitPrice: new Decimal(d.UNIT_PRICE),
    currency: d.CURRENCY,
    currencyRate: new Decimal(d.CURRENCY_RATE),
    customNotes: d.CUSTOM_NOTES,
    subtotal: new Decimal(d.SUBTOTAL),
    itemStatus: d.ITEM_STATUS,
    cardTo: d.CARD_TO,
    cardMessage: d.CARD_MESSAGE,
    cardFrom: d.CARD_FROM,
    cardNote: d.CARD_NOTE,
    cardCreatedBy: d.CARD_CREATED_BY,
    cardStatus: d.CARD_STATUS,
    deliveryBy: d.DELIVERY_BY,
    deliveryMethod: d.DELIVERY_METHOD,
    deliveryDate: d.DELIVERY_DATE ? serverDayJs(d.DELIVERY_DATE).toDate() : null,
    deliveryTime: d.DELIVERY_TIME ? serverDayJs(`${d.DELIVERY_DATE ? d.DELIVERY_DATE : serverDayJs().format("YYYY-MM-DD")} ${d.DELIVERY_TIME}`).toDate() : null,
    deliveryStatus: d.DELIVERY_STATUS,
    shippingFee: new Decimal(d.SHIPPING_FEE),
    receiverName: d.RECEIVER_NAME,
    receiverAddress: d.RECEIVER_ADDRESS,
    receiverPhone: d.RECEIVER_PHONE,
    imageUrls: d.IMAGE_URLS ?? [],
  };
}

/**
 * Versi partial dari `fromTransactionDetail` di atas — dipakai untuk UPDATE
 * item yang sudah ada. Cuma field yang benar-benar dikirim (!== undefined)
 * yang dimasukkan ke `data`, jadi field lain di row lama tidak ketiban
 * kosong/0 kalau kebetulan tidak disertakan di request.
 */
function fromTransactionDetailUpdates(
  d: Partial<Omit<TransactionDetail, 'ORDER_ID' | 'ORDER_ITEM_ID'>>
): Partial<Omit<TransactionDetailModel, "orderId" | "orderItemId">> {
  const data: Partial<Omit<TransactionDetailModel, "orderId" | "orderItemId">> = {};
  if (d.ITEM_NAME !== undefined) data.itemName = d.ITEM_NAME;
  if (d.QUANTITY !== undefined) data.quantity = Number(d.QUANTITY || 0);
  if (d.UNIT_PRICE !== undefined) data.unitPrice = new Decimal(d.UNIT_PRICE);
  if (d.CURRENCY !== undefined) data.currency = d.CURRENCY;
  if (d.CURRENCY_RATE !== undefined) data.currencyRate = new Decimal(d.CURRENCY_RATE);
  if (d.CUSTOM_NOTES !== undefined) data.customNotes = d.CUSTOM_NOTES;
  if (d.SUBTOTAL !== undefined) data.subtotal = new Decimal(d.SUBTOTAL);
  if (d.ITEM_STATUS !== undefined) data.itemStatus = d.ITEM_STATUS;
  if (d.CARD_TO !== undefined) data.cardTo = d.CARD_TO;
  if (d.CARD_MESSAGE !== undefined) data.cardMessage = d.CARD_MESSAGE;
  if (d.CARD_FROM !== undefined) data.cardFrom = d.CARD_FROM;
  if (d.CARD_NOTE !== undefined) data.cardNote = d.CARD_NOTE;
  if (d.CARD_CREATED_BY !== undefined) data.cardCreatedBy = d.CARD_CREATED_BY;
  if (d.CARD_STATUS !== undefined) data.cardStatus = d.CARD_STATUS;
  if (d.DELIVERY_BY !== undefined) data.deliveryBy = d.DELIVERY_BY;
  if (d.DELIVERY_METHOD !== undefined) data.deliveryMethod = d.DELIVERY_METHOD;
  if (d.DELIVERY_DATE !== undefined) {
    data.deliveryDate = d.DELIVERY_DATE ? serverDayJs(d.DELIVERY_DATE).toDate() : null;
  }
  if (d.DELIVERY_TIME !== undefined) {
    data.deliveryTime = d.DELIVERY_TIME
      ? serverDayJs(`${d.DELIVERY_DATE ? d.DELIVERY_DATE : serverDayJs().format("YYYY-MM-DD")} ${d.DELIVERY_TIME}`).toDate()
      : null;
  }
  if (d.DELIVERY_STATUS !== undefined) data.deliveryStatus = d.DELIVERY_STATUS;
  if (d.SHIPPING_FEE !== undefined) data.shippingFee = new Decimal(d.SHIPPING_FEE);
  if (d.RECEIVER_NAME !== undefined) data.receiverName = d.RECEIVER_NAME;
  if (d.RECEIVER_ADDRESS !== undefined) data.receiverAddress = d.RECEIVER_ADDRESS;
  if (d.RECEIVER_PHONE !== undefined) data.receiverPhone = d.RECEIVER_PHONE;
  if (d.IMAGE_URLS !== undefined) data.imageUrls = d.IMAGE_URLS ?? [];
  return data;
}

function fromTransactionUpdates(updates: Partial<Transaction>): Partial<TransactionModel> {
  const data: Partial<TransactionModel> = {};
  if (updates.ORDER_SOURCE !== undefined) data.orderSource = updates.ORDER_SOURCE;
  if (updates.SALES_NAME !== undefined) data.salesName = updates.SALES_NAME;
  if (updates.CUSTOMER_NAME !== undefined) data.customerName = updates.CUSTOMER_NAME;
  if (updates.CUSTOMER_ADDRESS !== undefined) data.customerAddress = updates.CUSTOMER_ADDRESS;
  if (updates.CUSTOMER_PHONE !== undefined) data.customerPhone = updates.CUSTOMER_PHONE;
  if (updates.CUSTOMER_EMAIL !== undefined) data.customerEmail = updates.CUSTOMER_EMAIL;
  if (updates.GRAND_TOTAL !== undefined) data.grandTotal = new Decimal(updates.GRAND_TOTAL);
  if (updates.DOWN_PAYMENT !== undefined) data.downPayment = new Decimal(updates.DOWN_PAYMENT);
  if (updates.REMAINING_BALANCE !== undefined) data.remainingBalance = new Decimal(updates.REMAINING_BALANCE);
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
  transaction: Omit<Transaction, 'ORDER_ID'>,
  details: Omit<TransactionDetail, 'ORDER_ID' | 'ORDER_ITEM_ID'>[]
): Promise<void> {
  const orderId = generateOrderId();
  await prisma.transaction.create({
    data: {
      ...fromTransaction(transaction),
      orderId,
      details: {
        create: details.map((r, i) => ({
          ...fromTransactionDetail(r),
          orderItemId: generateOrderItemId(orderId, i)
        })),
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

/**
 * Update transaksi SEKALIGUS baris-baris `details`-nya (dipanggil dari halaman
 * edit transaksi). Sebelumnya `updateTransaction` di atas cuma nyentuh tabel
 * Transaction, jadi perubahan item pesanan (tambah/hapus/ubah item, foto, dll)
 * saat edit tidak pernah tersimpan.
 *
 * Setiap detail yang dikirim dicocokkan ke row lama lewat ORDER_ITEM_ID:
 * - Ada ORDER_ITEM_ID & masih ada di DB -> UPDATE row itu.
 * - Tidak ada ORDER_ITEM_ID (item baru yang ditambah user saat edit) -> CREATE
 *   row baru dengan orderItemId baru, lanjut dari suffix terbesar yang ada.
 * - Row lama yang ORDER_ITEM_ID-nya tidak lagi ada di detail yang dikirim
 *   (dihapus user lewat tombol "Hapus Item") -> DELETE.
 *
 * Semua dibungkus 1 transaction db. Kalau ada row yang mau dihapus tapi masih
 * dipakai FloristAssignment/InvoiceDetail (FK-nya `onDelete: NoAction`), DB
 * akan menolak (P2003) dan seluruh perubahan di-rollback.
 */
export type TransactionDetailUpdateInput = Partial<Omit<TransactionDetail, 'ORDER_ID' | 'ORDER_ITEM_ID'>> & {
  ORDER_ITEM_ID?: string;
};

export async function updateTransactionWithDetails(
  orderId: string,
  updates: Partial<Transaction>,
  details: TransactionDetailUpdateInput[]
): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' | 'ITEM_IN_USE' }> {
  const existingRows = await prisma.transactionDetail.findMany({
    where: { orderId },
    select: { orderItemId: true },
  });
  const existingIds = new Set(existingRows.map((r) => r.orderItemId));

  const incomingIds = new Set(
    details.map((d) => d.ORDER_ITEM_ID).filter((v): v is string => !!v)
  );
  const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));

  // Nomor urut item baru lanjut dari suffix terbesar yang sudah ada (mis.
  // ORD-xxx-01, -02 -> item baru jadi -03), biar tidak tabrakan sama id lama.
  let nextIndex = existingRows.reduce((max, r) => {
    const m = r.orderItemId.match(/-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { orderId },
        data: fromTransactionUpdates(updates),
      });

      if (idsToDelete.length > 0) {
        await tx.transactionDetail.deleteMany({
          where: { orderItemId: { in: idsToDelete } },
        });
      }

      for (const d of details) {
        const { ORDER_ITEM_ID, ...rest } = d;
        if (ORDER_ITEM_ID && existingIds.has(ORDER_ITEM_ID)) {
          // Item lama -> PATCH: cuma field yang dikirim (!== undefined) yang
          // ditimpa, field lain di row itu tetap seperti sebelumnya.
          await tx.transactionDetail.update({
            where: { orderItemId: ORDER_ITEM_ID },
            data: fromTransactionDetailUpdates(rest),
          });
        } else {
          // Item baru -> perlu data lengkap (itemName, quantity, dll wajib
          // ada di kolom DB), jadi tetap pakai mapper full di sini.
          nextIndex += 1;
          await tx.transactionDetail.create({
            data: {
              ...fromTransactionDetail(rest as Omit<TransactionDetail, 'ORDER_ID' | 'ORDER_ITEM_ID'>),
              orderItemId: generateOrderItemId(orderId, nextIndex - 1),
              orderId,
            },
          });
        }
      }
    });
    return { ok: true };
  } catch (err: any) {
    if (err?.code === 'P2025') return { ok: false, reason: 'NOT_FOUND' };
    if (err?.code === 'P2003') return { ok: false, reason: 'ITEM_IN_USE' };
    throw err;
  }
}

export async function updateTransactionDetailItemStatus(
  orderItemId: string,
  updates: Partial<
    Pick<TransactionDetail, 'ITEM_STATUS' | 'DELIVERY_STATUS'>
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

export async function updateAllDeliveryStatusForOrder(
  orderId: string,
  deliveryStatus: string
): Promise<void> {
  await prisma.transactionDetail.updateMany({
    where: { orderId },
    data: { deliveryStatus },
  });
}

export async function listTransactionsWithDetailsAndAssignments(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ transactions: TransactionWithDetailsAndAssignments[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10)); // cap 100 biar gak disalahgunakan

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        details: {
          include: { floristAssignments: true },
        },
      },
    }),
    prisma.transaction.count(),
  ]);

  const transactions: TransactionWithDetailsAndAssignments[] = rows.map((t) => ({
    ...toTransaction(t),
    details: t.details.map((d) => ({
      ...toTransactionDetail(d),
      assignments: d.floristAssignments.map(toAssignmentLocal),
    })),
  }));

  return { transactions, total };
}

// isOrderFullyDone / filterOrdersByDeliveryStatus moved to '@/lib/statusUtils'
// (that module has no server-only imports, so it's safe to use from
// client components too — see src/app/florist/page.tsx and kurir/page.tsx).
export { isOrderFullyDone, filterOrdersByDeliveryStatus } from '@/lib/statusUtils';