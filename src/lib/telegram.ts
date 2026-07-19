import { validate, parse } from '@tma.js/init-data-node';

export interface TelegramUserPayload {
  id: number;
  username?: string;
}

export function validateTelegramInitData(
  initDataRaw: string
): TelegramUserPayload | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('Missing TELEGRAM_BOT_TOKEN env var');

  try {
    console.log('Telegram initData:', initDataRaw);
    console.log('botToken:', botToken);
    validate(initDataRaw, botToken, { expiresIn: 3600 });
  } catch (e) {
    console.error(e);
    return null;
  }

  const parsed = parse(initDataRaw);
  if (!parsed.user) return null;

  return {
    id: parsed.user.id,
    username: parsed.user.username,
  } as TelegramUserPayload;
}
