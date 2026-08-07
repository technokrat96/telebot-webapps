import { NextRequest, NextResponse } from "next/server";
import { findUserAuthByUsername } from "@/lib/db/users";
import { verifyPassword } from "@/lib/password";
import { signAuthToken } from "@/lib/jwt";
import { notifyMissingPasswordViaTelegram } from "@/lib/telegramBot/telegramBotUtil";

// POST body: { username: string, password: string }
// Login standalone di luar Telegram Mini App. Password harus sudah pernah
// di-set lewat halaman /telegram-setup (dibuka dari bot Telegram) —
// sebelum itu, akun belum punya password sama sekali.
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 },
      );
    }

    const user = await findUserAuthByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 },
      );
    }
    if (!user.password) {
      // Kalau chatId/telegramId-nya udah ke-capture (berarti orangnya
      // pernah buka bot), langsung kirim chat juga — jangan cuma ngandelin
      // dia baca pesan error di browser, yang mungkin dia nggak balik ke
      // Telegram sama sekali.
      const sent = await notifyMissingPasswordViaTelegram(
        user.username,
        user.chatId ?? user.telegramId,
      );

      return NextResponse.json(
        {
          error: sent
            ? "Akun ini belum punya password. Cek Telegram — kami sudah kirim tombol buat set password."
            : "Akun ini belum punya password. Buka bot Telegram, kirim /start, lalu set password dulu lewat tombol yang muncul.",
          code: "NO_PASSWORD",
        },
        { status: 403 },
      );
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 },
      );
    }

    const roles = user.roles.map((r) => r.role);
    if (roles.length === 0) {
      return NextResponse.json(
        {
          error: `Username @${user.username} belum punya ROLE yang valid. Hubungi admin.`,
        },
        { status: 403 },
      );
    }

    const token = signAuthToken({
      username: user.username,
      name: user.name,
      roles,
    });

    return NextResponse.json({
      token,
      name: user.name,
      username: user.username,
      roles,
      telegramLinked: !!(user.chatId || user.telegramId),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Login gagal." }, { status: 500 });
  }
}
