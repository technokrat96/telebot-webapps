import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import {
  findUserByUsername,
  setUserPassword,
  updateUserByUsername,
} from "@/lib/db/users";
import { hashPassword } from "@/lib/password";

const MIN_PASSWORD_LENGTH = 6;

// POST body: { initData: string, password: string }
// Dipanggil dari halaman /telegram-setup (dibuka lewat tombol web_app di
// bot Telegram). Otentikasi pakai initData Telegram yang sudah tervalidasi
// tanda tangannya oleh bot token — bukan JWT — karena tujuannya justru
// membuat kredensial username/password yang belum ada. Sekalian meng-update
// telegramId/chatId user supaya syarat "wajib 1x buka Telegram" terpenuhi.
export async function POST(req: NextRequest) {
  try {
    const { initData, password } = await req.json();
    if (!initData || !password) {
      return NextResponse.json(
        { error: "Data tidak lengkap." },
        { status: 400 },
      );
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` },
        { status: 400 },
      );
    }

    const telegramUser = validateTelegramInitData(
      typeof initData !== "string"
        ? new URLSearchParams(initData).toString()
        : initData,
    );
    if (!telegramUser) {
      return NextResponse.json(
        { error: "Invalid Telegram signature" },
        { status: 401 },
      );
    }
    if (!telegramUser.username) {
      return NextResponse.json(
        {
          error:
            "Akun Telegram kamu belum punya username. Set dulu di pengaturan Telegram.",
        },
        { status: 403 },
      );
    }

    const user = await findUserByUsername(telegramUser.username);
    if (!user) {
      return NextResponse.json(
        {
          error: `Username @${telegramUser.username} belum terdaftar. Minta admin daftarkan lewat bot dulu.`,
        },
        { status: 403 },
      );
    }

    const passwordHash = await hashPassword(password);
    await setUserPassword(user.USERNAME, passwordHash);

    // Capture telegramId/chatId di sini juga (best-effort) — untuk chat
    // pribadi dengan bot, id user Telegram sama dengan chat id-nya.
    await updateUserByUsername(user.USERNAME, {
      telegramId: String(telegramUser.id),
      chatId: String(telegramUser.id),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal menyimpan password." },
      { status: 500 },
    );
  }
}
