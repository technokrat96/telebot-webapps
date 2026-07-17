import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramInitData } from '@/lib/telegram';
import { findUserByUsername } from '@/lib/sheets/users';
import { parseRoles } from '@/lib/roles';

// POST body: { initData: string } — the raw initData string, obtained on
// the client via @telegram-apps/sdk-react's retrieveLaunchParams().initDataRaw
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }
    console.log(initData, typeof initData);
    const telegramUser = validateTelegramInitData(typeof initData !== 'string' ? JSON.stringify(initData) : initData);
    if (!telegramUser) {
      return NextResponse.json(
        { error: 'Invalid Telegram signature' },
        { status: 401 }
      );
    }

    if (!telegramUser.username) {
      return NextResponse.json(
        {
          error:
            'Your Telegram account has no username set. Please set one in Telegram settings.',
        },
        { status: 403 }
      );
    }

    const user = await findUserByUsername(telegramUser.username);
    if (!user) {
      return NextResponse.json(
        {
          error: `Username @${telegramUser.username} is not registered in the Users sheet.`,
        },
        { status: 403 }
      );
    }

    const roles = parseRoles(user.ROLE);
    if (roles.length === 0) {
      return NextResponse.json(
        {
          error: `Username @${telegramUser.username} belum punya ROLE yang valid di sheet Users.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      telegram: telegramUser,
      name: user.NAME,
      roles,
      username: user.USERNAME,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
