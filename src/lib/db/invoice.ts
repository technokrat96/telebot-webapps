import 'server-only';
import {prisma} from '@/lib/prismaClient';
import {Invoice, InvoiceDetail, InvoiceWithDetails} from '@/types';
import {InvoiceModel} from "@/generated/prisma/models/Invoice";
import {InvoiceDetailModel} from "@/generated/prisma/models/InvoiceDetail";
import dayjs from "dayjs";
import {Decimal} from "@prisma/client-runtime-utils";
import {generateInvoiceId, generateInvoiceItemId} from "@/lib/generateId";

// ---- Prisma (camelCase) <-> App types (SNAKE_CASE) mappers ----

function toInvoice(row: InvoiceModel): Invoice {
  return {
    INVOICE_ID: row.invoiceId,
    INVOICE_NUMBER: row.invoiceNumber ?? "",
    INVOICE_DATE: row.invoiceDate ? dayjs(row.invoiceDate).format("YYYY-MM-DD HH:mm:ss") : "",
    DUE_DATE: row.dueDate ? dayjs(row.dueDate).format("YYYY-MM-DD") : "",
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
    invoiceDate: dayjs(invoice.INVOICE_DATE).toDate(),
    dueDate: dayjs(invoice.DUE_DATE).toDate(),
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
  if (updates.INVOICE_DATE !== undefined) data.invoiceDate = dayjs(updates.INVOICE_DATE).toDate();
  if (updates.DUE_DATE !== undefined) data.dueDate = dayjs(updates.DUE_DATE).toDate();
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

export async function listInvoicesWithDetails(): Promise<
  InvoiceWithDetails[]
> {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' }, // newest first, dulu didapat dari .reverse()
    include: { details: true },
  });

  return invoices.map((inv) => ({
    ...toInvoice(inv),
    details: inv.details.map(toInvoiceDetail),
  }));
}

export async function createInvoice(
  invoice: Omit<Invoice, "INVOICE_ID">,
  details: Omit<InvoiceDetail, "INVOICE_ID" | "INVOICE_ITEM_ID">[]
): Promise<void> {
  const invoiceId = generateInvoiceId();
  await prisma.invoice.create({
    data: {
      ...fromInvoice(invoice),
      invoiceId,
      details: {
        create: details.map((e, i) => ({
          ...fromInvoiceDetail(e),
          invoiceItemId: generateInvoiceItemId(invoiceId, e.ORDER_ITEM_ID)
        })),
      },
    },
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