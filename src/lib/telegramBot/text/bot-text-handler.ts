import { Context } from "grammy";
import {
  clearBotSession,
  getBotSession,
  setBotSession,
} from "@/lib/db/botSession";
import { findUserByUsername, searchUsers } from "@/lib/db/users";
import { getMasterData } from "@/lib/db/masterData";
import {
  parseDataTelegram,
  validateUser,
} from "@/lib/telegramBot/telegramBotUtil";
import { ADMIN_ROLE } from "@/lib/telegramBot/telegramBotConst";
import {
  buildBackToMenuKeyboard,
  buildCheckedUserKeyboard,
  buildRoleSelectKeyboard,
  buildUsernameListKeyboard,
  CHECK_USER_LIST_SIZE,
  formatUserCard,
  formatUsernameListMessage,
} from "@/lib/telegramBot/menu";

function cleanUsernameInput(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

function isValidUsername(u: string): boolean {
  return /^[A-Za-z0-9_]{3,32}$/.test(u);
}

/**
 * Handler pesan teks biasa. Bot cuma punya satu command (/start) -- semua
 * yang lain dikendalikan lewat inline keyboard, KECUALI dua langkah yang
 * memang butuh input bebas: "ketik username yang mau didaftarkan" (Register
 * User) dan "ketik username yang mau dicek" (Check User). Dua langkah itu
 * dilacak lewat BotSession per chat (lihat src/lib/db/botSession.ts).
 */
export async function botTextHandler(ctx: Context) {
  const text = ctx.message?.text;
  if (!text) return;

  const chatId = ctx.chat?.id ? String(ctx.chat.id) : undefined;
  if (!chatId) return;

  if (text.startsWith("/")) {
    await ctx.reply(
      `Maaf, perintah "${text}" tidak dikenali. Ketik /start untuk memulai.`,
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  const session = await getBotSession(chatId);
  if (!session) {
    await ctx.reply(
      "Bot ini dikendalikan lewat tombol. Ketik /start untuk memulai.",
      {
        parse_mode: "HTML",
      },
    );
    return;
  }

  try {
    if (session.state === "AWAIT_REG_USERNAME") {
      await handleAwaitRegisterUsername(ctx, chatId, text);
      return;
    }

    if (session.state === "AWAIT_CHK_USERNAME") {
      await handleAwaitCheckUsername(ctx, chatId, text);
      return;
    }

    // State lain (mis. lagi milih role) diharapkan cuma diproses lewat
    // klik tombol, bukan teks. Ingatkan user tanpa mengubah state-nya.
    await ctx.reply(
      "Silakan gunakan tombol di atas untuk melanjutkan, atau ketik /start untuk kembali ke menu utama.",
      {
        parse_mode: "HTML",
      },
    );
  } catch (e) {
    await clearBotSession(chatId);
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`, { parse_mode: "HTML" });
    } else if (typeof e === "string") {
      await ctx.reply(e, { parse_mode: "HTML" });
    }
  }
}

async function handleAwaitRegisterUsername(
  ctx: Context,
  chatId: string,
  text: string,
) {
  const { userId, username, name } = await parseDataTelegram(ctx);
  const adminUser = await validateUser(ctx, { username, name, chatId, userId });
  if (!adminUser.ROLES.includes(ADMIN_ROLE)) {
    await clearBotSession(chatId);
    await ctx.reply("⛔ Anda tidak memiliki akses untuk fitur ini.", {
      parse_mode: "HTML",
      reply_markup: buildBackToMenuKeyboard(),
    });
    return;
  }

  const target = cleanUsernameInput(text);
  if (!isValidUsername(target)) {
    await ctx.reply(
      "⚠️ Username tidak valid. Username Telegram cuma boleh huruf, angka, underscore, 3-32 karakter. Ketik ulang:",
      { parse_mode: "HTML" },
    );
    return;
  }

  await setBotSession(chatId, "SELECT_REG_ROLES", {
    username: target,
    roles: [],
  });
  const { ROLES } = await getMasterData();
  await ctx.reply(
    `➕ <b>Register User</b>\n\nUsername: <b>@${target}</b>\nPilih role yang ingin diberikan, lalu tap "Simpan":`,
    { parse_mode: "HTML", reply_markup: buildRoleSelectKeyboard(ROLES, []) },
  );
}

async function handleAwaitCheckUsername(
  ctx: Context,
  chatId: string,
  text: string,
) {
  const { userId, username, name } = await parseDataTelegram(ctx);
  const adminUser = await validateUser(ctx, { username, name, chatId, userId });
  if (!adminUser.ROLES.includes(ADMIN_ROLE)) {
    await clearBotSession(chatId);
    await ctx.reply("⛔ Anda tidak memiliki akses untuk fitur ini.", {
      parse_mode: "HTML",
      reply_markup: buildBackToMenuKeyboard(),
    });
    return;
  }

  const query = cleanUsernameInput(text);
  const { items, total } = await searchUsers(query, CHECK_USER_LIST_SIZE);

  if (total === 0) {
    await ctx.reply(
      `❌ Tidak ada username yang mengandung "${query}". Coba kata kunci lain:`,
      {
        parse_mode: "HTML",
      },
    );
    // Tetap di state AWAIT_CHK_USERNAME supaya admin bisa langsung coba lagi.
    return;
  }

  if (total === 1) {
    const foundUser = await findUserByUsername(items[0].username);
    if (!foundUser) {
      await ctx.reply(
        `❌ Username @${items[0].username} tidak ditemukan lagi.`,
        { parse_mode: "HTML" },
      );
      return;
    }
    await setBotSession(chatId, "CHECKED_USER", {
      username: foundUser.USERNAME,
    });
    await ctx.reply(formatUserCard(foundUser), {
      parse_mode: "HTML",
      reply_markup: buildCheckedUserKeyboard(),
    });
    return;
  }

  // Lebih dari satu hasil -- tampilkan daftar dulu, admin bisa tap salah
  // satu (langsung terisi ke kotak input, tinggal kirim) atau ketik lebih
  // spesifik lagi buat mempersempit.
  await ctx.reply(formatUsernameListMessage(items, total), {
    parse_mode: "HTML",
    reply_markup: buildUsernameListKeyboard(items.map((u) => u.username)),
  });
}
