import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAvailableItems } from '@/lib/db/floristAssignment';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await listAvailableItems();
  return NextResponse.json({ items });
}