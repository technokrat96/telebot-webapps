import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listTransactionsWithDetails } from '@/lib/db/transaction';

// Florist queue: all orders + their line items, so the florist can see
// item-level notes (custom notes, card message) while working.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN', 'FLORIST']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orders = await listTransactionsWithDetails();
  return NextResponse.json({ orders });
}
