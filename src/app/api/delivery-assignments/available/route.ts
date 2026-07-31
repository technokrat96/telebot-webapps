import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAvailableItemsPaged } from '@/lib/db/deliveryDriverAssignment';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { items, total } = await listAvailableItemsPaged({ page, pageSize });
  return NextResponse.json({ items, total, page, pageSize });
}
