import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createTransaction,
  listTransactionsWithDetails, listTransactionsWithDetailsAndAssignments,
} from '@/lib/db/transaction';
import { Transaction, TransactionDetail } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { transactions, total } = await listTransactionsWithDetailsAndAssignments({ page, pageSize });
  return NextResponse.json({ transactions, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    transaction: Transaction;
    details: Omit<TransactionDetail, 'ORDER_ID'>[];
  };

  if (!body.transaction?.ORDER_ID) {
    return NextResponse.json({ error: 'ORDER_ID is required' }, { status: 400 });
  }

  await createTransaction(body.transaction, body.details ?? []);
  return NextResponse.json({ ok: true });
}
