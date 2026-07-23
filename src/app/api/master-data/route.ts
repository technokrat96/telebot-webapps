import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMasterData } from '@/lib/db/masterData';

// Any authenticated user (any role) can read master data — it's just
// dropdown options, not sensitive data.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const masterData = await getMasterData();
  return NextResponse.json({ masterData });
}