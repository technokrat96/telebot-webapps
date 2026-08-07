import {NextRequest, NextResponse} from 'next/server';
import {requireAuth} from '@/lib/auth';
import {getTodayAttendance, listMyAttendance} from '@/lib/db/attendance';

// Siapa saja yang sudah login (role apapun) boleh absen.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const [today, { attendance, total }] = await Promise.all([
    getTodayAttendance(auth.TELEGRAM_USER),
    listMyAttendance(auth.TELEGRAM_USER, { page, pageSize }),
  ]);

  return NextResponse.json({ today, history: attendance, total, page, pageSize });
}