import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {CommandContext, Context} from "grammy";

const botCmdWhoAmIDesc = "Cek profil data Anda yang terdaftar di sistem";
const botCmdWhoAmI = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    const user = await validateUser(ctx, {username, name, chatId, userId});

    const {USERNAME, NAME, ROLES} = user;
    const messageReply = (
      `Berikut data Anda yang terdaftar di sistem:\n\n` +
      `👤 <b>Nama:</b> ${NAME}\n` +
      `🏷️ <b>Username:</b> @${USERNAME}\n` +
      `💼 <b>Role:</b> <i>${ROLES.join(", ")}</i>`
    );

    await ctx.reply(messageReply, {
      parse_mode: "HTML"
    });
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`);
    } else if (typeof e == "string") {
      await ctx.reply(e);
    }
  }
}

export {
  botCmdWhoAmIDesc,
  botCmdWhoAmI
};