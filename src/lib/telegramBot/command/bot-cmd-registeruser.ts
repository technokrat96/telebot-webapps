import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {COMMAND_LIST} from "@/lib/telegramBot/telegramBotConst";
import {CommandContext, Context} from "grammy";
import {findUserByUsername, insertRoleUser, insertUser} from "@/lib/db/users";
import {getMasterData} from "@/lib/db/masterData";

const botCmdRegisterUserDesc = "Mendaftarkan user dan memberi role";
const botCmdRegisterUser = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    await validateUser(ctx, {username, name, chatId, userId});

    const {
      user: inputUser,
      inputRole,
    } = await validateMessageRegistrationUser(ctx);

    await insertRoleUser(inputUser.USERNAME, inputRole);

    if (!(inputUser.CHAT_ID == null && inputUser.TELEGRAM_ID == null)) {
      const messageNotif = `
⚠️ <b>User Registered</b>
An admin has been assign a role <b>${inputRole}</b> to you. Copy and send this command to check your role:
<code>/${COMMAND_LIST.whoami}</code>
`;
      const targetChatId = inputUser.CHAT_ID ?? inputUser.TELEGRAM_ID ?? "";
      if (targetChatId) {
        await ctx.api.sendMessage(
          targetChatId,
          messageNotif,
          {
            parse_mode: "HTML",
          },
        );
      }
    }

    const messageReply = `✅ <b>Successfully.</b>
Assigning role <code>${inputRole.toUpperCase()}</code> to user <b>@${inputUser.USERNAME}</b>.`;

    await ctx.reply(messageReply, {parse_mode: 'HTML'});
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`);
    } else if (typeof e == "string") {
      await ctx.reply(e);
    }
  }
}

async function validateMessageRegistrationUser(ctx: CommandContext<Context>) {
  const args = ctx.match;
  if (!args) {
    throw `❌ <b>Error:</b> Please provide both a username and a role.
<b>Format:</b> <code>/${COMMAND_LIST.registeruser} [username] [ROLE]</code>
<i>Example: <code>/${COMMAND_LIST.registeruser} john_doe ADMIN</code></i>`
      ;
  }

  const [inputUsername, inputRole] = args
    .replace("\n", " ")
    .trim()
    .split(' ', 2);

  if (!inputUsername || !inputRole) {
    throw `⚠️ <b>Invalid Format!</b>
Make sure you include both parameters.

<b>Format:</b> <code>/${COMMAND_LIST.registeruser} [username] [ROLE]</code>
<i>Example: <code>/${COMMAND_LIST.registeruser} john_doe ADMIN</code></i>`
      ;
  }

  await ctx.reply(
    `🔄 <b>Processing...</b>
Assigning role <b>${inputRole.toUpperCase()}</b> to user <b>@${inputUsername}</b>.`,
    {parse_mode: 'HTML'}
  );

  let user = await findUserByUsername(inputUsername);

  if (!user) {
    // throw `Username @${inputUsername} is not registered in the Users database.`;
    user = await insertUser({
      username: inputUsername,
      name: '',
      chatId: null,
      telegramId: null,
    })
  }
  const { ROLES } = await getMasterData();

  if (!ROLES.includes(inputRole)) {
    throw `Role ${inputRole} is not registered in the Master Data database.`;
  }

  return {
    user,
    inputRole,
  }
}

export {
  botCmdRegisterUserDesc,
  botCmdRegisterUser
};