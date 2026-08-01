import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { claimItem, listMyAssignmentsWithDetailPaged } from '@/lib/db/floristAssignment';
import { findUserByUsername } from '@/lib/db/users';
import { hasAnyRole } from '@/lib/roles';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const { assignments, total } = await listMyAssignmentsWithDetailPaged(auth.TELEGRAM_USER, { page, pageSize });
  return NextResponse.json({ assignments, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['FLORIST', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderItemId, orderId, quantity, targetUsername } = await req.json();

  // Default: florist ambil/klaim item untuk dirinya sendiri. Admin bisa
  // meng-assign item ke florist lain lewat halaman detail transaksi --
  // dalam hal itu targetUsername dikirim dan harus benar-benar punya
  // role FLORIST.
  let florist = { username: auth.TELEGRAM_USER, name: auth.USER.NAME };
  if (targetUsername) {
    if (!hasAnyRole(auth.USER.ROLES, ['ADMIN'])) {
      return NextResponse.json({ error: 'Hanya admin yang bisa assign ke user lain' }, { status: 403 });
    }
    const targetUser = await findUserByUsername(targetUsername);
    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }
    if (!hasAnyRole(targetUser.ROLES, ['FLORIST'])) {
      return NextResponse.json({ error: 'User tersebut tidak punya role FLORIST' }, { status: 400 });
    }
    florist = { username: targetUser.USERNAME, name: targetUser.NAME };
  }

  try {
    const assignment = await claimItem(orderItemId, orderId, Number(quantity), florist);
    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}