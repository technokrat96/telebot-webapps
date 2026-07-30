import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAllAttendance } from '@/lib/db/attendance';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const username = searchParams.get('username') ?? undefined;
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { attendance, total } = await listAllAttendance({ from, to, username, page, pageSize });
  return NextResponse.json({ attendance, total, page, pageSize });
}