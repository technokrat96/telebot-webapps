import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createInvoice, listInvoicesWithDetails } from '@/lib/db/invoice';
import { Invoice, InvoiceDetail } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { invoices, total } = await listInvoicesWithDetails({ page, pageSize });
  return NextResponse.json({ invoices, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    invoice: Omit<Invoice, "INVOICE_ID">;
    details: Omit<InvoiceDetail, "INVOICE_ID" | "INVOICE_ITEM_ID">[];
  };

  try {
    await createInvoice(body.invoice, body.details ?? []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
