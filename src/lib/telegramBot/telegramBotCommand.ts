import { Api, Bot, Context, RawApi } from "grammy";
import { COMMAND_LIST } from "@/lib/telegramBot/telegramBotConst";
import { botCmdStart } from "@/lib/telegramBot/command/bot-cmd-start";
import { botCallbackHandler } from "@/lib/telegramBot/callback/bot-callback-handler";
import { botTextHandler } from "@/lib/telegramBot/text/bot-text-handler";

const telegramBotCommand = (bot: Bot<Context, Api<RawApi>>) => {
  // Cuma /start yang jadi slash command. Semua menu lain (Who Am I,
  // Register User, Check User, Edit User, Hapus User) lewat inline
  // keyboard -- lihat bot-callback-handler.ts & bot-text-handler.ts.
  bot.command(COMMAND_LIST.start, botCmdStart);

  bot.on("callback_query:data", botCallbackHandler);

  bot.on("message:text", botTextHandler);
};

export default telegramBotCommand;
