import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTodayAttendance, checkIn, listMyAttendance } from '@/lib/db/attendance';

// Siapa saja yang sudah login (role apapun) boleh absen.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [today, history] = await Promise.all([
    getTodayAttendance(auth.telegramUsername),
    listMyAttendance(auth.telegramUsername),
  ]);

  return NextResponse.json({ today, history });
}