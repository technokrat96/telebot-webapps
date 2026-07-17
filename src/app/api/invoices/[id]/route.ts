import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listInvoicesWithDetails, updateInvoice } from '@/lib/sheets/invoice';
import { Invoice } from '@/types';

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const invoices = await listInvoicesWithDetails();
  const invoice = invoices.find((i) => i.INVOICE_ID === id);
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ invoice });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const updates = (await req.json()) as Partial<Invoice>;
  const ok = await updateInvoice(id, updates);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
