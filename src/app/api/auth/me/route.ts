import {NextRequest, NextResponse} from 'next/server';
import {verifyAuthToken} from '@/lib/jwt';
import {findUserAuthByUsername} from '@/lib/db/users';

// GET, Authorization: Bearer <jwt> — dipanggil AuthProvider tiap kali app
// dibuka untuk memastikan token masih valid dan mengambil ROLES/nama
// ter-update (bukan dari payload JWT lama), sekaligus cek apakah user
// sudah pernah "mengunjungi" Telegram (chatId/telegramId ke-isi).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  const payload = verifyAuthToken(token);
  if (!payload?.username) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login lagi.' }, { status: 401 });
  }

  const user = await findUserAuthByUsername(payload.username);
  if (!user) {
    return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 401 });
  }
  const roles = user.roles.map((r) => r.role);
  if (roles.length === 0) {
    return NextResponse.json({ error: 'Akun belum punya ROLE. Hubungi admin.' }, { status: 403 });
  }

  return NextResponse.json({
    name: user.name,
    username: user.username,
    roles,
    telegramLinked: !!(user.chatId || user.telegramId),
    hasPassword: !!user.password,
  });
}
