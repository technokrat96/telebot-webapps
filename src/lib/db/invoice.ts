import 'server-only';
import {prisma} from '@/lib/prismaClient';
import {
  Invoice,
  InvoiceDetail,
  InvoicePdfData,
  InvoiceWithDetails,
  OrderItemWithBilling,
  TransactionWithBilling
} from '@/types';
import {InvoiceModel} from "@/generated/prisma/models/Invoice";
import {InvoiceDetailModel} from "@/generated/prisma/models/InvoiceDetail";
import {Decimal} from "@prisma/client-runtime-utils";
import {generateInvoiceId, generateInvoiceItemId} from "@/lib/generateId";
import {listTransactionsWithDetails} from '@/lib/db/transaction';
import serverDayJs from "@/lib/server.dayjs";

// ---- Prisma (camelCase) <-> App types (SNAKE_CASE) mappers ----

function toInvoice(row: InvoiceModel): Invoice {
  return {
    INVOICE_ID: row.invoiceId,
    INVOICE_NUMBER: row.invoiceNumber ?? "",
    INVOICE_DATE: row.invoiceDate ? serverDayJs(row.invoiceDate).format("YYYY-MM-DD HH:mm:ss") : "",
    DUE_DATE: row.dueDate ? serverDayJs(row.dueDate).format("YYYY-MM-DD") : "",
    TOTAL_AMOUNT: row.totalAmount.toNumber(),
    AMOUNT_PAID: row.amountPaid.toNumber(),
    INVOICE_STATUS: row.invoiceStatus,
    BILLED_TO: row.billedTo,
    BILLED_ADDRESS: row.billedAddress ?? "",
    BILLED_PHONE: row.billedPhone ?? "",
  };
}

function toInvoiceDetail(row: InvoiceDetailModel): InvoiceDetail {
  return {
    INVOICE_ITEM_ID: row.invoiceItemId,
    INVOICE_ID: row.invoiceId,
    ORDER_ITEM_ID: row.orderItemId,
    QUANTITY_BILLED: row.quantityBilled.toNumber(),
    PRICE_BILLED: row.priceBilled.toNumber(),
  };
}

function fromInvoice(invoice: Omit<Invoice, "INVOICE_ID">): Omit<InvoiceModel, "invoiceId" | "createdAt"> {
  return {
    invoiceNumber: invoice.INVOICE_NUMBER,
    invoiceDate: serverDayJs(invoice.INVOICE_DATE).toDate(),
    dueDate: serverDayJs(invoice.DUE_DATE).toDate(),
    totalAmount: new Decimal(invoice.TOTAL_AMOUNT),
    amountPaid: new Decimal(invoice.AMOUNT_PAID),
    invoiceStatus: invoice.INVOICE_STATUS,
    billedTo: invoice.BILLED_TO,
    billedAddress: invoice.BILLED_ADDRESS,
    billedPhone: invoice.BILLED_PHONE,
  };
}

function fromInvoiceDetail(detail: Omit<InvoiceDetail, 'INVOICE_ID' | "INVOICE_ITEM_ID">): Omit<InvoiceDetailModel, "invoiceId" | "invoiceItemId"> {
  return {
    orderItemId: detail.ORDER_ITEM_ID,
    quantityBilled: new Decimal(detail.QUANTITY_BILLED),
    priceBilled: new Decimal(detail.PRICE_BILLED),
  };
}

function fromInvoiceUpdates(updates: Partial<Invoice>): Partial<InvoiceModel> {
  const data: Partial<InvoiceModel> = {};
  if (updates.INVOICE_NUMBER !== undefined) data.invoiceNumber = updates.INVOICE_NUMBER;
  if (updates.INVOICE_DATE !== undefined) data.invoiceDate = serverDayJs(updates.INVOICE_DATE).toDate();
  if (updates.DUE_DATE !== undefined) data.dueDate = serverDayJs(updates.DUE_DATE).toDate();
  if (updates.TOTAL_AMOUNT !== undefined) data.totalAmount = new Decimal(updates.TOTAL_AMOUNT);
  if (updates.AMOUNT_PAID !== undefined) data.amountPaid = new Decimal(updates.AMOUNT_PAID);
  if (updates.INVOICE_STATUS !== undefined) data.invoiceStatus = updates.INVOICE_STATUS;
  if (updates.BILLED_TO !== undefined) data.billedTo = updates.BILLED_TO;
  if (updates.BILLED_ADDRESS !== undefined) data.billedAddress = updates.BILLED_ADDRESS;
  if (updates.BILLED_PHONE !== undefined) data.billedPhone = updates.BILLED_PHONE;
  return data;
}

export async function listInvoices(): Promise<Invoice[]> {
  const rows = await prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toInvoice);
}

export async function listInvoiceDetails(): Promise<InvoiceDetail[]> {
  const rows = await prisma.invoiceDetail.findMany();
  return rows.map(toInvoiceDetail);
}

export async function listInvoicesWithDetails(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ invoices: InvoiceWithDetails[]; total: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 10)); // cap 100 biar gak disalahgunakan

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' }, // newest first, dulu didapat dari .reverse()
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { details: true },
    }),
    prisma.invoice.count(),
  ]);

  const invoices: InvoiceWithDetails[] = rows.map((inv) => ({
    ...toInvoice(inv),
    details: inv.details.map(toInvoiceDetail),
  }));

  return { invoices, total };
}

/** Satu invoice by id, dipakai di /api/invoices/[id] (sebelumnya nge-fetch
 * semua invoice lalu .find() -- jadi ikut kepotong pagination di atas). */
export async function getInvoiceWithDetailsById(
  invoiceId: string
): Promise<InvoiceWithDetails | null> {
  const inv = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: { details: true },
  });
  if (!inv) return null;
  return { ...toInvoice(inv), details: inv.details.map(toInvoiceDetail) };
}

export async function createInvoice(
  invoice: Omit<Invoice, "INVOICE_ID">,
  details: Omit<InvoiceDetail, "INVOICE_ID" | "INVOICE_ITEM_ID">[]
): Promise<void> {
  if (details.length === 0) throw new Error('Invoice harus punya minimal 1 item');

  const invoiceId = generateInvoiceId();
  // Urutan konsisten (sorted) biar kalau ada 2 invoice yang overlap order
  // item-nya kebentuk barengan, dua-duanya ngunci baris dengan urutan yang
  // sama -- nyegah deadlock.
  const orderItemIds = [...new Set(details.map((d) => d.ORDER_ITEM_ID))].sort();

  await prisma.$transaction(async (tx) => {
    for (const id of orderItemIds) {
      await tx.$queryRaw`SELECT order_item_id FROM transaction_detail WHERE order_item_id = ${id} FOR UPDATE`;
    }

    const items = await tx.transactionDetail.findMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    const itemById = new Map(items.map((i) => [i.orderItemId, i]));

    const billedRows = await tx.invoiceDetail.findMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    // Qty yang sudah ditagih invoice lain, dihitung ulang dari DB sekarang
    // (bukan dipercaya dari payload client yang render-nya bisa udah basi).
    const runningBilled = billedRows.reduce((acc, r) => {
      acc[r.orderItemId] = (acc[r.orderItemId] ?? 0) + r.quantityBilled.toNumber();
      return acc;
    }, {} as Record<string, number>);

    for (const d of details) {
      const item = itemById.get(d.ORDER_ITEM_ID);
      if (!item) throw new Error(`Order item ${d.ORDER_ITEM_ID} tidak ditemukan`);

      const alreadyBilled = runningBilled[d.ORDER_ITEM_ID] ?? 0;
      const remaining = Number(item.quantity || 0) - alreadyBilled;
      if (d.QUANTITY_BILLED > remaining) {
        throw new Error(
          `"${item.itemName}" sisa qty yang bisa ditagih cuma ${remaining}, tidak bisa tagih ${d.QUANTITY_BILLED}`
        );
      }
      // Akumulasi biar 2 baris item yang sama dalam 1 invoice yang sama juga kecek bareng.
      runningBilled[d.ORDER_ITEM_ID] = alreadyBilled + d.QUANTITY_BILLED;
    }

    await tx.invoice.create({
      data: {
        ...fromInvoice(invoice),
        invoiceId,
        details: {
          create: details.map((e) => ({
            ...fromInvoiceDetail(e),
            invoiceItemId: generateInvoiceItemId(invoiceId, e.ORDER_ITEM_ID),
          })),
        },
      },
    });
  });
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<boolean> {
  try {
    await prisma.invoice.update({
      where: { invoiceId },
      data: fromInvoiceUpdates(updates),
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2025') return false; // record to update not found
    throw err;
  }
}

// ---- Billing summary (qty sudah ditagih vs sisa, per item & per order) ----

async function getBilledQtyByOrderItem(): Promise<Record<string, number>> {
  const details = await listInvoiceDetails();
  return details.reduce((acc, d) => {
    acc[d.ORDER_ITEM_ID] = (acc[d.ORDER_ITEM_ID] ?? 0) + Number(d.QUANTITY_BILLED || 0);
    return acc;
  }, {} as Record<string, number>);
}

/** Semua transaksi + status penagihan tiap item-nya (billed/sisa qty). */
export async function listOrdersWithBillingSummary(): Promise<TransactionWithBilling[]> {
  const [orders, billedMap] = await Promise.all([
    listTransactionsWithDetails(),
    getBilledQtyByOrderItem(),
  ]);

  return orders.map((order) => {
    const details: OrderItemWithBilling[] = order.details.map((d) => {
      const billedQty = billedMap[d.ORDER_ITEM_ID] ?? 0;
      const remainingQty = Math.max(0, Number(d.QUANTITY || 0) - billedQty);
      return { ...d, billedQty, remainingQty };
    });

    const totalQty = details.reduce((s, d) => s + Number(d.QUANTITY || 0), 0);
    const totalRemaining = details.reduce((s, d) => s + d.remainingQty, 0);

    const invoiceStatus: TransactionWithBilling['invoiceStatus'] =
      totalRemaining === totalQty
        ? 'NOT_INVOICED'
        : totalRemaining === 0
          ? 'FULLY_INVOICED'
          : 'PARTIAL';

    return { ...order, details, invoiceStatus };
  });
}

/** Billing summary untuk satu transaksi (dipakai di halaman create invoice). */
export async function getOrderBillingSummary(
  orderId: string
): Promise<TransactionWithBilling | null> {
  const orders = await listOrdersWithBillingSummary();
  return orders.find((o) => o.ORDER_ID === orderId) ?? null;
}

/** Invoice + nama item + data transaksi terkait, khusus untuk render PDF. */
export async function getInvoicePdfData(invoiceId: string): Promise<InvoicePdfData | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      details: {
        include: {
          transactionDetail: {
            include: { transaction: true },
          },
        },
      },
    },
  });
  if (!invoice) return null;

  const firstDetail = invoice.details[0]?.transactionDetail;

  return {
    ...toInvoice(invoice),
    orderId: firstDetail?.orderId ?? '',
    customerName: firstDetail?.transaction.customerName ?? '',
    customerAddress: firstDetail?.transaction.customerAddress ?? '',
    customerPhone: firstDetail?.transaction.customerPhone ?? '',
    items: invoice.details.map((d) => ({
      ITEM_NAME: d.transactionDetail.itemName,
      QUANTITY_BILLED: d.quantityBilled.toNumber(),
      PRICE_BILLED: d.priceBilled.toNumber(),
    })),
  };
}