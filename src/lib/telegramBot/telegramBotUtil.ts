import {CommandContext, Context} from "grammy";
import {
  findUserByUsername,
  findUsersAdminNotMeAndHasChatIdOrTelegramId,
  insertUser,
  updateUserByUsername
} from "@/lib/db/users";
import {getMasterData} from "@/lib/db/masterData";
import {COMMAND_LIST} from "@/lib/telegramBot/telegramBotConst";

export async function parseDataTelegram(ctx: CommandContext<Context>) {
  const chatId = ctx.message?.chat?.id;
  const chatType = ctx.message?.chat?.type;
  const messageId = ctx.message?.message_id;
  const userId = ctx.message?.from?.id;
  const username = ctx.message?.from?.username ?? ctx.message?.chat?.username;

  const firstName = ctx.message?.from?.first_name ?? ctx.message?.chat?.first_name ?? '';
  const lastName = ctx.message?.from?.last_name ?? ctx.message?.chat?.last_name ?? '';

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

export async function validateUser(ctx: CommandContext<Context>, {username, name, chatId, userId}: {
  username: string,
  name: string,
  chatId?: string,
  userId?: string,
}) {
  const user = await findUserByUsername(username);

  const {ROLES} = await getMasterData();

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

An admin needs to assign a role to this user. Copy and send this command to the bot:
${ROLES.map((role) => `<code>/${COMMAND_LIST.registeruser} ${username} ${role}</code>`).join('\n')}
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