import {Api, Bot, Context, RawApi} from "grammy";
import {COMMAND_LIST} from "@/lib/telegramBot/telegramBotConst";
import {botCmdStart} from "@/lib/telegramBot/command/bot-cmd-start";
import {botCmdHelp} from "@/lib/telegramBot/command/bot-cmd-help";
import {botCmdWhoAmI} from "@/lib/telegramBot/command/bot-cmd-whoami";
import {botCmdRegisterUser} from "@/lib/telegramBot/command/bot-cmd-registeruser";
import {botCmdCheckUser} from "@/lib/telegramBot/command/bot-cmd-checkuser";

const telegramBotCommand = (bot: Bot<Context, Api<RawApi>>) => {
  bot.command(COMMAND_LIST.start, botCmdStart);
  bot.command(COMMAND_LIST.help, botCmdHelp);
  bot.command(COMMAND_LIST.whoami, botCmdWhoAmI);
  bot.command(COMMAND_LIST.registeruser, botCmdRegisterUser);
  bot.command(COMMAND_LIST.checkuser, botCmdCheckUser);

  bot.on('message:text', async (ctx) => {
    const text = ctx.message?.text;

    if (text && text.startsWith('/')) {
      await ctx.reply(`Maaf, perintah "${text}" tidak dikenali. Ketik /${COMMAND_LIST.help} untuk melihat bantuan.`, {
        parse_mode: "HTML"
      });
    } else {
      await ctx.reply('Bot ini hanya merespon perintah/command.', {
        parse_mode: "HTML"
      });
    }
  });
}

export default telegramBotCommand;