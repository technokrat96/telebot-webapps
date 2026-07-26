import { Bot, webhookCallback } from 'grammy';

// 1. Inisialisasi bot dengan token dari environment variable (.env.local)
const token = process.env.TELEGRAM_BOT_TOKEN;
const secretToken = process.env.TELEGRAM_BOT_SECRET_TOKEN;
if (!token) throw new Error('Bot Token belum diatur!');
if (!secretToken) throw new Error('Secret Token belum diatur!');

const bot = new Bot(token);

// 2. Definisikan fitur bot Anda di sini
// Merespon command /start
bot.command('start', async (ctx) => {
  await ctx.reply('Halo! Selamat datang di bot Next.js.');
});

// Merespon command /help
bot.command('help', async (ctx) => {
  await ctx.reply('Ada yang bisa saya bantu? Kirim pesan apa saja, nanti saya tiru.');
});

bot.on('message:text', async (ctx) => {
  // Jika teks tidak diawali dengan tanda '/' (artinya bukan command)
  if (!ctx.message.text.startsWith('/')) {
    await ctx.reply('Maaf, bot ini hanya menerima perintah/command (diawali dengan /).');
  }
});

// 3. Export fungsi POST menggunakan adapter webhookCallback bawaan grammY
// Set runtime ke 'std' (standard Web API) agar cocok dengan NextResponse/NextJS Request
export const POST = webhookCallback(bot, 'std/http');
