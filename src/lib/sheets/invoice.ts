import { appendRow, readSheet, updateRow } from '@/lib/googleSheets';
import { Invoice, InvoiceDetail, InvoiceWithDetails } from '@/types';

const INVOICE_SHEET = 'Invoice';
const INVOICE_DETAIL_SHEET = 'Invoice Detail';

export async function listInvoices(): Promise<Invoice[]> {
  return readSheet<Invoice>(INVOICE_SHEET);
}

export async function listInvoiceDetails(): Promise<InvoiceDetail[]> {
  return readSheet<InvoiceDetail>(INVOICE_DETAIL_SHEET);
}

export async function listInvoicesWithDetails(): Promise<
  InvoiceWithDetails[]
> {
  const [invoices, details] = await Promise.all([
    listInvoices(),
    listInvoiceDetails(),
  ]);

  return invoices
    .map((inv) => ({
      ...inv,
      details: details.filter((d) => d.INVOICE_ID === inv.INVOICE_ID),
    }))
    .reverse();
}

export async function createInvoice(
  invoice: Invoice,
  details: Omit<InvoiceDetail, 'INVOICE_ID'>[]
): Promise<void> {
  await appendRow(INVOICE_SHEET, invoice);
  for (const detail of details) {
    await appendRow(INVOICE_DETAIL_SHEET, {
      ...detail,
      INVOICE_ID: invoice.INVOICE_ID,
    });
  }
}

export async function updateInvoice(
  invoiceId: string,
  updates: Partial<Invoice>
): Promise<boolean> {
  return updateRow(INVOICE_SHEET, 'INVOICE_ID', invoiceId, updates);
}
