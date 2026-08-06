import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {clearBotSession} from "@/lib/db/botSession";
import {buildMainMenuKeyboard} from "@/lib/telegramBot/menu";
import {CommandContext, Context} from "grammy";

const botCmdStartDesc = "Memulai dan cek status aktif bot";
const botCmdStart = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    const user = await validateUser(ctx, {username, name, chatId, userId});

    // Selalu mulai dari kondisi bersih -- kalau sebelumnya user lagi di
    // tengah flow (misal lagi diminta ketik username), /start membatalkan
    // itu dan kembali ke menu utama.
    if (chatId) {
      await clearBotSession(chatId);
    }

    const keyboard = buildMainMenuKeyboard(user);

    const messageReply =
      `Halo <b>${user.NAME || "Pengguna"}</b>! Status bot dalam keadaan aktif.\n\n` +
      `Silakan pilih menu di bawah ini:`;

    await ctx.reply(messageReply, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`, {
        parse_mode: "HTML",
      },);
    } else if (typeof e == "string") {
      await ctx.reply(e, {
        parse_mode: "HTML",
      },);
    }
  }
}

export {
  botCmdStartDesc,
  botCmdStart
};
