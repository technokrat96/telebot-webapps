import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { claimItem, listMyAssignmentsWithDetail } from '@/lib/sheets/floristAssignment';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const assignments = await listMyAssignmentsWithDetail(auth.telegramUsername);
  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderItemId, orderId, quantity } = await req.json();
  try {
    const assignment = await claimItem(orderItemId, orderId, Number(quantity), {
      username: auth.telegramUsername,
      name: auth.user.NAME,
    });
    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}