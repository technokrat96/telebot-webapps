import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { releaseAssignment } from '@/lib/sheets/floristAssignment';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ok = await releaseAssignment(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}