import {Context, InlineKeyboard} from "grammy";
import {
  findUserByUsername,
  findUsersAdminNotMeAndHasChatIdOrTelegramId,
  insertUser,
  updateUserByUsername
} from "@/lib/db/users";
import telegramBot from "@/lib/telegramBot";

/**
 * Ambil data pengirim dari Context grammy generik. Dipakai baik dari
 * command handler (/start, `ctx.message`) maupun dari callback query
 * handler (klik inline button, `ctx.callbackQuery`) -- `ctx.from`/`ctx.chat`
 * bawaan grammy sudah otomatis fallback ke sumber yang sesuai untuk
 * keduanya, jadi satu fungsi ini cukup untuk semua flow.
 */
export async function parseDataTelegram(ctx: Context) {
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;
  const messageId = ctx.msgId;
  const userId = ctx.from?.id;
  const username = ctx.from?.username;

  const firstName = ctx.from?.first_name ?? '';
  const lastName = ctx.from?.last_name ?? '';

  const name = `${firstName} ${lastName}`.trim();

  if (!username) {
    throw `Username is missing`;
  }

  return {
    chatId: chatId ? String(chatId) : undefined,
    chatType,
    messageId: messageId ? String(messageId) : undefined,
    userId: userId ? String(userId) : undefined,
    username,
    name,
  }
}

/** Domain publik webapp (tanpa trailing slash), atau undefined kalau APP_URL belum diatur. */
export function getAppBaseUrl(): string | undefined {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return undefined;
  return appUrl.replace(/\/$/, '');
}

/**
 * Tombol-tombol Telegram Web App khusus notifikasi "percobaan login browser
 * terdeteksi tapi belum punya password" (lihat notifyMissingPasswordViaTelegram
 * di bawah):
 * 1. "Buka Aplikasi" -> root webapp, login diam-diam pakai initData Telegram.
 * 2. "Set/Ganti Password" -> /telegram-setup, buat akses lewat browser biasa.
 */
export function telegramAppKeyboard(): InlineKeyboard | undefined {
  const base = getAppBaseUrl();
  if (!base) return undefined;
  return new InlineKeyboard()
    .webApp('🌸 Buka Aplikasi', base)
    .row()
    .webApp('🔑 Set / Ganti Password (opsional, buat akses browser)', `${base}/telegram-setup`);
}

/**
 * Dipanggil dari /api/auth/login (bukan dari dalam bot command) waktu ada
 * yang coba login browser tapi akun-nya belum punya password. Kalau
 * chatId/telegramId user itu udah ke-capture sebelumnya, kirim chat lewat
 * bot langsung berisi tombol "Set / Ganti Password" — jangan cuma
 * ngandelin dia baca pesan error di layar login.
 *
 * Return true kalau chat-nya berhasil terkirim (dipakai buat nentuin pesan
 * error mana yang ditampilkan di layar login).
 */
export async function notifyMissingPasswordViaTelegram(
  username: string,
  targetChatId: string | null | undefined
): Promise<boolean> {
  if (!targetChatId) return false;
  try {
    await telegramBot.api.sendMessage(
      targetChatId,
      '⚠️ <b>Percobaan login webapp terdeteksi</b>\n\n' +
        `Username <b>@${username}</b> baru saja coba login lewat browser, tapi akun ini belum punya password. Ketuk tombol di bawah buat set password dulu.`,
      {
        parse_mode: 'HTML',
        reply_markup: telegramAppKeyboard(),
      }
    );
    return true;
  } catch (err) {
    // Bot mungkin diblokir user, atau chatId basi — jangan sampai gagal
    // kirim notif bikin request login-nya ikut error.
    console.error('Gagal kirim notif set-password ke Telegram:', err);
    return false;
  }
}

export async function validateUser(ctx: Context, {username, name, chatId, userId}: {
  username: string,
  name: string,
  chatId?: string,
  userId?: string,
}) {
  const user = await findUserByUsername(username);

  if (!user) {
    await insertUser({
      username,
      name,
      chatId: chatId ?? null,
      telegramId: userId ?? null,
    });

    const adminUser = await findUsersAdminNotMeAndHasChatIdOrTelegramId(username);
    if (adminUser.length > 0) {
      for (const user of adminUser) {
        if (user.CHAT_ID == null && user.TELEGRAM_ID == null) continue;

        const htmlMessage = `
⚠️ <b>New User Registration Notif</b>

User baru <b>@${username}</b> butuh di-assign role. Buka bot, ketik /start, tap tombol "➕ Register User", lalu ketik username <code>${username}</code>.
`;
        await ctx.api.sendMessage(
          user.CHAT_ID ?? user.TELEGRAM_ID ?? "",
          htmlMessage,
          {
            parse_mode: "HTML",
          },
        );
      }

      throw `Username @${username} is not registered in the Users database. Please wait admin registering you.`;
    } else {
      throw `No administrators found in the user database`;
    }
  }

  await updateUserByUsername(username, {
    name: name,
    telegramId: userId ? String(userId) : undefined,
    chatId: chatId ? String(chatId) : undefined,
  })

  return user;
}