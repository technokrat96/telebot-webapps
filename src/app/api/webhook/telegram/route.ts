import {webhookCallback} from 'grammy';
import {telegramBot} from "@/lib/telegramBot";

const SECRET_TOKEN = process.env.TELEGRAM_BOT_SECRET_TOKEN;
if (!SECRET_TOKEN) throw new Error('Secret Token belum diatur!');
// 3. Export fungsi POST menggunakan adapter webhookCallback bawaan grammY
// Set runtime ke 'std' (standard Web API) agar cocok dengan NextResponse/NextJS Request
export const POST = webhookCallback(telegramBot, 'std/http', {
  secretToken : SECRET_TOKEN,
});
