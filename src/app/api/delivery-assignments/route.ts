import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { claimItem, listAvailableItemsPaged, listMyAssignmentsWithDetail } from '@/lib/db/deliveryDriverAssignment';
import { findUserByUsername } from '@/lib/db/users';
import { hasAnyRole } from '@/lib/roles';

// GET gabungan: "punya saya" (semua, tidak dipaginasi) + "tersedia"
// (dipaginasi lewat page/pageSize) dalam satu response -- lihat
// api/florist-assignments/route.ts untuk pola yang sama.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const pageSize = Number(searchParams.get('pageSize') ?? '10') || 10;

  const [mine, available] = await Promise.all([
    listMyAssignmentsWithDetail(auth.TELEGRAM_USER),
    listAvailableItemsPaged({ page, pageSize }),
  ]);

  return NextResponse.json({ mine, available, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['KURIR', 'ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderItemId, orderId, quantity, targetUsername } = await req.json();

  // Default: kurir ambil/klaim item untuk dirinya sendiri. Admin bisa
  // meng-assign item ke kurir lain lewat halaman detail transaksi --
  // dalam hal itu targetUsername dikirim dan harus benar-benar punya
  // role KURIR.
  let deliveryDriver = { username: auth.TELEGRAM_USER, name: auth.USER.NAME };
  if (targetUsername) {
    if (!hasAnyRole(auth.USER.ROLES, ['ADMIN'])) {
      return NextResponse.json({ error: 'Hanya admin yang bisa assign ke user lain' }, { status: 403 });
    }
    const targetUser = await findUserByUsername(targetUsername);
    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }
    if (!hasAnyRole(targetUser.ROLES, ['KURIR'])) {
      return NextResponse.json({ error: 'User tersebut tidak punya role KURIR' }, { status: 400 });
    }
    deliveryDriver = { username: targetUser.USERNAME, name: targetUser.NAME };
  }

  try {
    const assignment = await claimItem(orderItemId, orderId, Number(quantity), deliveryDriver);
    return NextResponse.json({ assignment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
