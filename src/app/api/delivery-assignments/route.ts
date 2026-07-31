import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { claimItem, listMyAssignmentsWithDetailPaged } from '@/lib/db/deliveryDriverAssignment';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { assignments, total } = await listMyAssignmentsWithDetailPaged(auth.TELEGRAM_USER, { page, pageSize });
  return NextResponse.json({ assignments, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderItemId, orderId, quantity } = await req.json();
  try {
    const assignment = await claimItem(orderItemId, orderId, Number(quantity), {
      username: auth.TELEGRAM_USER,
      name: auth.USER.NAME,
    });
    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
