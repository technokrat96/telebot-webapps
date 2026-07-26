import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createInvoice, listInvoicesWithDetails } from '@/lib/db/invoice';
import { Invoice, InvoiceDetail } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invoices = await listInvoicesWithDetails();
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    invoice: Invoice;
    details: Omit<InvoiceDetail, "INVOICE_ID" | "INVOICE_ITEM_ID">[];
  };

  await createInvoice(body.invoice, body.details ?? []);
  return NextResponse.json({ ok: true });
}
