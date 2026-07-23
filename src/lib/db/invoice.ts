import { prisma } from '@/lib/prismaClient';
import { Invoice, InvoiceDetail, InvoiceWithDetails } from '@/types';

// ---- Prisma (camelCase) <-> App types (SNAKE_CASE) mappers ----

function toInvoice(row: any): Invoice {
  return {
    INVOICE_ID: row.invoiceId,
    INVOICE_NUMBER: row.invoiceNumber,
    INVOICE_DATE: row.invoiceDate,
    DUE_DATE: row.dueDate,
    TOTAL_AMOUNT: Number(row.totalAmount),
    AMOUNT_PAID: Number(row.amountPaid),
    INVOICE_STATUS: row.invoiceStatus,
    BILLED_TO: row.billedTo,
    BILLED_ADDRESS: row.billedAddress,
    BILLED_PHONE: row.billedPhone,
  };
}

function toInvoiceDetail(row: any): InvoiceDetail {
  return {
    INVOICE_ITEM_ID: row.invoiceItemId,
    INVOICE_ID: row.invoiceId,
    ORDER_ITEM_ID: row.orderItemId,
    QUANTITY_BILLED: Number(row.quantityBilled),
    PRICE_BILLED: Number(row.priceBilled),
  };
}

function fromInvoice(invoice: Invoice) {
  return {
    invoiceId: invoice.INVOICE_ID,
    invoiceNumber: invoice.INVOICE_NUMBER,
    invoiceDate: invoice.INVOICE_DATE,
    dueDate: invoice.DUE_DATE,
    totalAmount: invoice.TOTAL_AMOUNT,
    amountPaid: invoice.AMOUNT_PAID,
    invoiceStatus: invoice.INVOICE_STATUS,
    billedTo: invoice.BILLED_TO,
    billedAddress: invoice.BILLED_ADDRESS,
    billedPhone: invoice.BILLED_PHONE,
  };
}

function fromInvoiceDetail(detail: Omit<InvoiceDetail, 'INVOICE_ID'>) {
  return {
    invoiceItemId: detail.INVOICE_ITEM_ID,
    orderItemId: detail.ORDER_ITEM_ID,
    quantityBilled: detail.QUANTITY_BILLED,
    priceBilled: detail.PRICE_BILLED,
  };
}

function fromInvoiceUpdates(updates: Partial<Invoice>) {
  const data: Record<string, unknown> = {};
  if (updates.INVOICE_NUMBER !== undefined) data.invoiceNumber = updates.INVOICE_NUMBER;
  if (updates.INVOICE_DATE !== undefined) data.invoiceDate = updates.INVOICE_DATE;
  if (updates.DUE_DATE !== undefined) data.dueDate = updates.DUE_DATE;
  if (updates.TOTAL_AMOUNT !== undefined) data.totalAmount = updates.TOTAL_AMOUNT;
  if (updates.AMOUNT_PAID !== undefined) data.amountPaid = updates.AMOUNT_PAID;
  if (updates.INVOICE_STATUS !== undefined) data.invoiceStatus = updates.INVOICE_STATUS;
  if (updates.BILLED_TO !== undefined) data.billedTo = updates.BILLED_TO;
  if (updates.BILLED_ADDRESS !== undefined) data.billedAddress = updates.BILLED_ADDRESS;
  if (updates.BILLED_PHONE !== undefined) data.billedPhone = updates.BILLED_PHONE;
  return data;
}

// ---- Public API (signature identik dengan versi Google Sheets) ----

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
  invoice: Invoice,
  details: Omit<InvoiceDetail, 'INVOICE_ID'>[]
): Promise<void> {
  await prisma.invoice.create({
    data: {
      ...fromInvoice(invoice),
      details: {
        create: details.map(fromInvoiceDetail),
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