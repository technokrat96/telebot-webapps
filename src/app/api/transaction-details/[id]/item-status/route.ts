import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { updateTransactionDetailItemStatus } from '@/lib/sheets/transaction';

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const ok = await updateTransactionDetailItemStatus(id, {
    ITEM_STATUS: body.ITEM_STATUS,
    FLORIST_NAME: body.FLORIST_NAME ?? auth.user.NAME,
  });

  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
