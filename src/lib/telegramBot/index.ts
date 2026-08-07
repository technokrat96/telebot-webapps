import 'server-only';
import {Bot} from "grammy";
import telegramBotCommand from "@/lib/telegramBot/telegramBotCommand";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET_TOKEN = process.env.TELEGRAM_BOT_SECRET_TOKEN;
if (!BOT_TOKEN) throw new Error('Bot Token belum diatur!');
if (!SECRET_TOKEN) throw new Error('Secret Token belum diatur!');


const telegramBot = new Bot(BOT_TOKEN);
telegramBotCommand(telegramBot);

export default telegramBot;