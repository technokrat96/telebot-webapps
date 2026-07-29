import {CommandContext, Context} from "grammy";
import {COMMAND_LIST} from "@/lib/telegramBot/telegramBotConst";
import {findUserByUsername} from "@/lib/db/users";
import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";

const botCmdCheckUserDesc = "Memerika user sudah ada atau valid";
const botCmdCheckUser = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    await validateUser(ctx, {username, name, chatId, userId});

    const inputUser = await validateMessageCheckUser(ctx);


    const {USERNAME, NAME, ROLES} = inputUser;
    const messageReply = (
      `Berikut data Anda yang terdaftar di sistem:\n\n` +
      `👤 <b>Nama:</b> ${NAME}\n` +
      `🏷️ <b>Username:</b> @${USERNAME}\n` +
      `💼 <b>Role:</b> <i>${ROLES.join(", ")}</i>`
    );

    await ctx.reply(messageReply, {parse_mode: 'HTML'});
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

async function validateMessageCheckUser(ctx: CommandContext<Context>) {
  const args = ctx.match;
  if (!args) {
    throw `❌ <b>Error:</b> Please provide both a username.
<b>Format:</b> <code>/${COMMAND_LIST.checkuser} [username]</code>
<i>Example: <code>/${COMMAND_LIST.checkuser} john_doe</code></i>`
      ;
  }

  const [inputUsername] = args
    .replace("\n", " ")
    .trim()
    .split(' ', 1);

  if (!inputUsername) {
    throw `⚠️ <b>Invalid Format!</b>
Make sure you include both parameters.

<b>Format:</b> <code>/${COMMAND_LIST.checkuser} [username]</code>
<i>Example: <code>/${COMMAND_LIST.checkuser} john_doe</code></i>`
      ;
  }

  const user = await findUserByUsername(inputUsername);

  if (!user) {
    throw `Username @${inputUsername} is not registered in the Users database.`;
  }

  return user
}

export {
  botCmdCheckUserDesc,
  botCmdCheckUser
};