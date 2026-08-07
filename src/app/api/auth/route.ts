import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { findUserAuthByUsername } from "@/lib/db/users";

// POST body: { initData: string } — the raw initData string, obtained on
// the client via @telegram-apps/sdk-react's retrieveLaunchParams().initDataRaw
//
// Dipakai satu-satunya oleh halaman /telegram-setup (Mini App) untuk
// memvalidasi identitas Telegram user dan mengecek apakah dia sudah pernah
// set password (`hasPassword`). Halaman-halaman lain di webapp standalone
// tidak lagi memakai initData — mereka pakai JWT (lihat /api/auth/login).
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    if (!initData) {
      return NextResponse.json({ error: "Missing initData" }, { status: 400 });
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
            "Your Telegram account has no username set. Please set one in Telegram settings.",
        },
        { status: 403 },
      );
    }

    const user = await findUserAuthByUsername(telegramUser.username);
    if (!user) {
      return NextResponse.json(
        {
          error: `Username @${telegramUser.username} is not registered in the Users database.`,
        },
        { status: 403 },
      );
    }

    const roles = user.roles.map((r) => r.role);
    if (roles.length === 0) {
      return NextResponse.json(
        {
          error: `Username @${telegramUser.username} belum punya ROLE yang valid.`,
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      name: user.name,
      roles,
      username: user.username,
      hasPassword: !!user.password,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
