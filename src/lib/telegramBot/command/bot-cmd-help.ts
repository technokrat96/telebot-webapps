import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {CommandContext, Context} from "grammy";
import {
  ALLOWED_COMMAND_ALL_ROLE,
  ALLOWED_COMMAND_BY_ROLE,
  COMMAND_DESC_LIST,
  COMMAND_LIST
} from "@/lib/telegramBot/telegramBotConst";

const botCmdHelpDesc = "Menampilkan daftar perintah bot yang tersedia";
const botCmdHelp = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    const user = await validateUser(ctx, {username, name, chatId, userId});

    const allowedKeys = new Set<keyof typeof COMMAND_LIST>([...ALLOWED_COMMAND_ALL_ROLE]);

    if (user.ROLES && Array.isArray(user.ROLES)) {
      user.ROLES.forEach((roleName) => {
        const roleCmds = ALLOWED_COMMAND_BY_ROLE[roleName];
        if (roleCmds) {
          roleCmds.forEach((cmdKey) => allowedKeys.add(cmdKey));
        }
      });
    }

    const commandList = Object.entries(COMMAND_LIST)
      .filter(([key]) => allowedKeys.has(key as keyof typeof COMMAND_LIST))
      .map(
        ([key, cmd]) =>
          `/${cmd} - ${COMMAND_DESC_LIST[key as keyof typeof COMMAND_LIST] ?? "Tanpa deskripsi"}`,
      )
      .join("\n");

    const messageReply = `🤖 <b>Daftar Perintah Bot yang Tersedia untuk Anda</b>:\n\n${commandList}`;

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
  botCmdHelpDesc,
  botCmdHelp
};