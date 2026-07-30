import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listOrdersForKurirPaged } from '@/lib/db/transaction';

// Antrian kurir: order yang siap diambil s/d dalam perjalanan (PICKUP, ON
// DELIVERY, DELIVERED), sudah difilter & di-page di DB.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN', 'KURIR']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { orders, total } = await listOrdersForKurirPaged({ page, pageSize });
  return NextResponse.json({ orders, total, page, pageSize });
}
