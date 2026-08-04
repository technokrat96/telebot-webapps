import {NextRequest, NextResponse} from 'next/server';
import {validateTelegramInitData} from '@/lib/telegram';
import {findUserAuthByUsername, updateUserByUsername} from '@/lib/db/users';
import {signAuthToken} from '@/lib/jwt';

// POST body: { initData: string }
//
// Login "diam-diam" dipakai HANYA saat webapp dibuka dari dalam Telegram
// Mini App — tidak perlu username/password sama sekali, initData Telegram
// (yang sudah tervalidasi tanda tangannya oleh bot token) jadi bukti
// identitas. Setiap kali dipanggil, chatId/telegramId user ikut ter-update,
// jadi cukup membuka Mini App ini (mis. lewat menu bot) untuk memenuhi
// syarat "wajib 1x mengunjungi Telegram" — tidak perlu lagi lewat
// /telegram-setup untuk itu (halaman itu sekarang murni buat yang mau
// login lewat browser biasa di luar Telegram, karena itu perlu password).
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const telegramUser = validateTelegramInitData(
      typeof initData !== 'string' ? new URLSearchParams(initData).toString() : initData
    );
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram signature' }, { status: 401 });
    }
    if (!telegramUser.username) {
      return NextResponse.json(
        { error: 'Akun Telegram kamu belum punya username. Set dulu di pengaturan Telegram.' },
        { status: 403 }
      );
    }

    const user = await findUserAuthByUsername(telegramUser.username);
    if (!user) {
      return NextResponse.json(
        { error: `Username @${telegramUser.username} belum terdaftar. Minta admin daftarkan lewat bot dulu.` },
        { status: 403 }
      );
    }

    const roles = user.roles.map((r) => r.role);
    if (roles.length === 0) {
      return NextResponse.json(
        { error: `Username @${telegramUser.username} belum punya ROLE yang valid.` },
        { status: 403 }
      );
    }

    // Chat pribadi dengan bot: id user Telegram = chat id-nya.
    await updateUserByUsername(user.username, {
      telegramId: String(telegramUser.id),
      chatId: String(telegramUser.id),
    });

    const token = signAuthToken({ username: user.username, name: user.name, roles });

    return NextResponse.json({
      token,
      name: user.name,
      username: user.username,
      roles,
      telegramLinked: true,
      hasPassword: !!user.password,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login gagal.' }, { status: 500 });
  }
}
