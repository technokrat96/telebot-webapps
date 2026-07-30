import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTransactionById, updateTransactionWithDetails, TransactionDetailUpdateInput } from '@/lib/db/transaction';
import { Transaction } from '@/types';

// Next.js 15+: dynamic route `params` is now a Promise and must be awaited.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const transaction = await getTransactionById(id);
  if (!transaction) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ transaction });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as {
    transaction: Partial<Transaction>;
    details?: TransactionDetailUpdateInput[];
  };

  const result = await updateTransactionWithDetails(id, body.transaction ?? {}, body.details ?? []);
  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Item tidak bisa dihapus karena sudah ada florist assignment/invoice terkait' },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
