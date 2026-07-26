import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listOrdersWithBillingSummary } from '@/lib/db/invoice';

// Semua transaksi + status penagihan per item (dipakai di halaman
// "pilih transaksi" sebelum buat invoice).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orders = await listOrdersWithBillingSummary();
  return NextResponse.json({ orders });
}