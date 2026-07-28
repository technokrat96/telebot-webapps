import 'server-only';
import {User} from "@/types";
import {Bot, CommandContext, Context, InputFile} from "grammy";
import {
  findUserByUsername,
  findUsersAdminAndHasChatIdOrTelegramId,
  insertRoleUser, insertUser,
  updateUserByUsername
} from "@/lib/db/users";
import {getMasterData} from "@/lib/db/masterData";

interface COMMAND_DATA {
  user: User;
  messageReceived: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET_TOKEN = process.env.TELEGRAM_BOT_SECRET_TOKEN;
if (!BOT_TOKEN) throw new Error('Bot Token belum diatur!');
if (!SECRET_TOKEN) throw new Error('Secret Token belum diatur!');

const COMMANDS = {
  start: "start",
  help: "help",
  whoami: "whoami",
  registerUser: "registeruser",
};

const ALL_ROLE_COMMANDS = [
  "start",
  "help",
  "whoami",
] as const;

const ROLE_COMMANDS: Record<string, Exclude<(keyof typeof COMMANDS), (typeof ALL_ROLE_COMMANDS)[number]>[]> = {
  ADMIN: ['registerUser'],
  FLORIST: [],
  KURIR: [],
};

const COMMAND_DESC: Record<keyof typeof COMMANDS, string> = {
  start: "Memulai dan cek status aktif bot",
  help: "Menampilkan daftar perintah bot yang tersedia",
  whoami: "Cek profil data Anda yang terdaftar di sistem",
  registerUser: "Register user",
};

function startMessage(user: User) {
  let messageReply = `Halo <b>${user.NAME || "Pengguna"}</b>! Status bot dalam keadaan aktif.`;

  // Memanggil fungsi help secara internal untuk menampilkan menu sesuai role USER
  const daftarMenu = helpMessage(user);
  messageReply += `\n\n${daftarMenu}`;

  return messageReply;
}

function helpMessage(user: User) {
  const allowedKeys = new Set<keyof typeof COMMANDS>([...ALL_ROLE_COMMANDS]);

  if (user.ROLES && Array.isArray(user.ROLES)) {
    user.ROLES.forEach((roleName) => {
      const roleCmds = ROLE_COMMANDS[roleName];
      if (roleCmds) {
        roleCmds.forEach((cmdKey) => allowedKeys.add(cmdKey));
      }
    });
  }

  const commandList = Object.entries(COMMANDS)
    .filter(([key]) => allowedKeys.has(key as keyof typeof COMMANDS))
    .map(
      ([key, cmd]) =>
        `${cmd} - ${COMMAND_DESC[key as keyof typeof COMMANDS] || "Tanpa deskripsi"}`,
    )
    .join("\n");

  return `🤖 <b>Daftar Perintah Bot yang Tersedia untuk Anda</b>:\n\n${commandList}`;
}

async function registerUserMessage(ctx: CommandContext<Context>) {
  const args = ctx.match;
  if (!args) {
    throw `❌ <b>Error:</b> Please provide both a username and a role.
<b>Format:</b> <code>/role [username] [ROLE]</code>
<i>Example: <code>/role john_doe ADMIN</code></i>`
      ;
  }

  const [inputUsername, inputRole] = args
    .replace("\n", " ")
    .trim()
    .split(' ', 2);

  if (!inputUsername || !inputRole) {
    throw `⚠️ <b>Invalid Format!</b>
Make sure you include both parameters.

<b>Usage:</b> <code>/role [inputUsername] [ROLE]</code>`
      ;
  }

  await ctx.reply(
    `🔄 <b>Processing...</b>
Assigning role <code>${inputRole.toUpperCase()}</code> to user <b>@${inputUsername}</b>.`,
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

const telegramBot = new Bot(BOT_TOKEN);

async function getParseData(ctx: CommandContext<Context>) {
  const chatId = ctx.message?.chat?.id;
  const chatType = ctx.message?.chat?.type;
  const messageId = ctx.message?.message_id;
  const userId = ctx.message?.from?.id;
  const username = ctx.message?.from?.username ?? ctx.message?.chat?.username;

  const firstName = ctx.message?.from?.first_name ?? ctx.message?.chat?.first_name ?? '';
  const lastName = ctx.message?.from?.last_name ?? ctx.message?.chat?.last_name ?? '';

// Menggabungkan nama depan dan nama belakang, lalu menghapus spasi berlebih
  const name = `${firstName} ${lastName}`.trim();

  if (!username) {
    throw `Username is missing`;
  }

  return {
    chatId,
    chatType,
    messageId,
    userId,
    username,
    name,
  }
}

async function getUser({username, name, chatId, userId}: {
  username: string,
  name: string,
  chatId?: string | number,
  userId?: string | number
}) {
  const user = await findUserByUsername(username);

  const { ROLES } = await getMasterData();

  if (!user) {
    await insertUser({
      username,
      name,
      chatId: chatId ? String(chatId) : null,
      telegramId: userId ? String(userId) : null,
    });

    const adminUser = await findUsersAdminAndHasChatIdOrTelegramId();
    if (adminUser.length > 0) {
      for (const user of adminUser) {
        if (user.CHAT_ID == null && user.TELEGRAM_ID == null) continue;

        const htmlMessage = `
⚠️ <b>New User Registration Notif</b>

An admin needs to assign a role to this user. Copy and send this command to the bot:
${ROLES.map((role) => `<code>/${COMMANDS.registerUser} ${username} ${role}</code>`).join('\n')}
`;
        await telegramBot.api.sendMessage(
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

telegramBot.command('start', async (ctx) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await getParseData(ctx);

    const user = await getUser({username, name, chatId, userId});

    await ctx.reply(startMessage(user), {
      parse_mode: "HTML"
    });
    return;
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`);
    } else if (typeof e == "string") {
      await ctx.reply(e);
    }
  }
});

telegramBot.command('help', async (ctx) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await getParseData(ctx);

    const user = await getUser({username, name, chatId, userId});

    await ctx.reply(helpMessage(user), {
      parse_mode: "HTML"
    });
    return;
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`);
    } else if (typeof e == "string") {
      await ctx.reply(e);
    }
  }
});

telegramBot.command('registeruser', async (ctx) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await getParseData(ctx);

    await getUser({username, name, chatId, userId});

    const {
      user: inputUser,
      inputRole,
    } = await registerUserMessage(ctx);

    await insertRoleUser(inputUser.USERNAME, inputRole);

    if (!(inputUser.CHAT_ID == null && inputUser.TELEGRAM_ID == null)) {
      const htmlMessage = `
⚠️ <b>User Registered</b>

An admin has been assign a role <b>${inputRole}<b> to you. Copy and send this command to check your role:

<code>/whoami</code>
`;
      await telegramBot.api.sendMessage(
        inputUser.CHAT_ID ?? inputUser.TELEGRAM_ID ?? "",
        htmlMessage,
        {
          parse_mode: "HTML",
        },
      );
    }

    await ctx.reply(
      `✅ <b>Successfully.</b>
Assigning role <code>${inputRole.toUpperCase()}</code> to user <b>@${inputUser.USERNAME}</b>.`,
      {parse_mode: 'HTML'}
    );
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`, {parse_mode: 'HTML'});
    } else if (typeof e == "string") {
      await ctx.reply(e, {parse_mode: 'HTML'});
    }
  }
});

telegramBot.on('message:text', async (ctx) => {
  const text = ctx.message?.text;

  if (text && text.startsWith('/')) {
    await ctx.reply(`Maaf, perintah "${text}" tidak dikenali. Ketik /help untuk melihat bantuan.`, {
      parse_mode: "HTML"
    });
  } else {
    await ctx.reply('Bot ini hanya merespon perintah/command.', {
      parse_mode: "HTML"
    });
  }
});

export {telegramBot};
export async function sendTelegramDocument(
  chatId: string,
  fileBuffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  await telegramBot.api.sendDocument(
    chatId,
    new InputFile(new Uint8Array(fileBuffer), filename),
    {
    caption: caption,
    },
  );
}