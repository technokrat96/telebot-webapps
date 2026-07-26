import {Bot, webhookCallback} from 'grammy';
import {User} from "@/types";

interface COMMAND_DATA {
  user: User;
  messageReceived: string;
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secretToken = process.env.TELEGRAM_BOT_SECRET_TOKEN;
if (!token) throw new Error('Bot Token belum diatur!');
if (!secretToken) throw new Error('Secret Token belum diatur!');

const COMMANDS = {
  start: "start",
  help: "help",
  whoami: "whoami",
  test: "test",
};

const ALL_ROLE_COMMANDS = [
  "start",
  "help",
  "whoami",
] as const;

const ROLE_COMMANDS: Record<string, Exclude<(keyof typeof COMMANDS), (typeof ALL_ROLE_COMMANDS)[number]>[]> = {
  ADMIN: [],
  FLORIST: [],
  KURIR: [],
};

const COMMAND_DESC: Record<keyof typeof COMMANDS, string> = {
  start: "Memulai dan cek status aktif bot",
  help: "Menampilkan daftar perintah bot yang tersedia",
  whoami: "Cek profil data Anda yang terdaftar di sistem",
  test: "test",
};

const COMMAND_FN: Record<
  keyof typeof COMMANDS,
  (data: COMMAND_DATA) => string
> = {
  start: (data: COMMAND_DATA) => {
    let messageReply = `Halo <b>${data.user.NAME || "Pengguna"}</b>! Status bot dalam keadaan aktif.`;

    // Memanggil fungsi help secara internal untuk menampilkan menu sesuai role user
    const daftarMenu = COMMAND_FN.help(data);
    messageReply += `\n\n${daftarMenu}`;

    return messageReply;
  },

  help: ({ user }: COMMAND_DATA) => {
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
  },

  whoami: ({ user }: COMMAND_DATA): string => {
    const { USERNAME: username, NAME: name, ROLES: role } = user;
    return (
      `Berikut data Anda yang terdaftar di sistem:\n\n` +
      `👤 <b>Nama:</b> ${name}\n` +
      `🏷️ <b>Username:</b> @${username}\n` +
      `💼 <b>Role:</b> <i>${role}</i>`
    );
  },

  test: ({ user }: COMMAND_DATA): string => {
    const { USERNAME: username, NAME: name, ROLES: role } = user;
    return (
      `Berikut data Anda yang terdaftar di sistem:\n\n` +
      `👤 <b>Nama:</b> ${name}\n` +
      `🏷️ <b>Username:</b> @${username}\n` +
      `💼 <b>Role:</b> <i>${role}</i>`
    );
  },
} as const;

const bot = new Bot(token);

// 2. Definisikan fitur bot Anda di sini
// Merespon command /start
bot.command('start', async (ctx) => {
  const chatId = ctx.message?.chat?.id;
  const chatType = ctx.message?.chat?.type;
  const messageId = ctx.message?.message_id;
  const username = ctx.message?.from?.username ?? ctx.message?.chat?.username;
  const messageReceived = ctx.message?.text;
  await ctx.reply('Halo! Selamat datang di bot Next.js.');
});

// Merespon command /help
bot.command('help', async (ctx) => {
  await ctx.reply('Ada yang bisa saya bantu? Kirim pesan apa saja, nanti saya tiru.');
});

bot.on('message:text', async (ctx) => {
  const text = ctx.message?.text;

  if (text && text.startsWith('/')) {
    await ctx.reply(`Maaf, perintah "${text}" tidak dikenali. Ketik /help untuk melihat bantuan.`);
  } else {
    await ctx.reply('Bot ini hanya merespon perintah/command.');
  }
});

// 3. Export fungsi POST menggunakan adapter webhookCallback bawaan grammY
// Set runtime ke 'std' (standard Web API) agar cocok dengan NextResponse/NextJS Request
export const POST = webhookCallback(bot, 'std/http');
