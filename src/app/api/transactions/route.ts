import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createTransaction,
  listTransactionsWithDetails,
} from '@/lib/db/transaction';
import { Transaction, TransactionDetail } from '@/types';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const transactions = await listTransactionsWithDetails();
  return NextResponse.json({ transactions });
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
