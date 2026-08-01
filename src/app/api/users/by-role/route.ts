import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listUsersByRole } from '@/lib/db/users';

/** Dropdown "assign ke florist/kurir" di halaman detail transaksi admin. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['ADMIN']);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');
  if (!role) return NextResponse.json({ error: 'Query param role wajib diisi' }, { status: 400 });

  const users = await listUsersByRole(role);
  return NextResponse.json({ users });
}
