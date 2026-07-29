import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listUsersWithTelegramId } from '@/lib/db/users';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await listUsersWithTelegramId();
  return NextResponse.json({ users });
}