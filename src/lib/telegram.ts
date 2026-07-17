// NOTE: the client SDK we use is @telegram-apps/sdk-react (as requested).
// For server-side init-data validation specifically we use @tma.js/init-data-node
// instead of its sibling @telegram-apps/init-data-node — the latter's own
// package page marks it "not supported anymore, use @tma.js/init-data-node
// instead" (both come from the same Telegram-Mini-Apps/tma.js monorepo,
// just published under a newer scope). Function names/behavior are the same.
import { validate, parse } from '@tma.js/init-data-node';

export interface TelegramUserPayload {
  id: number;
  username?: string;
}

/**
 * Validates the raw `initDataRaw` string sent by the Telegram Mini App
 * client (see src/lib/apiClient.ts and TelegramProvider, which read it via
 * @telegram-apps/sdk-react's `retrieveLaunchParams()`).
 *
 * `validate()` throws if the signature doesn't match the bot token, or if
 * initData is older than `expiresIn` seconds. We treat any failure as "not
 * authenticated" rather than surfacing the specific error to the client.
 *
 * Docs: https://docs.telegram-mini-apps.com/packages/tma-js-init-data-node
 */
export function validateTelegramInitData(
  initDataRaw: string
): TelegramUserPayload | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('Missing TELEGRAM_BOT_TOKEN env var');

  try {
    // expiresIn: how many seconds after `auth_date` the initData is
    // considered valid. 1 hour is a reasonable session-open window for a
    // Mini App; tighten this if you want shorter-lived sessions.
    validate(initDataRaw, botToken, { expiresIn: 3600 });
  } catch {
    return null;
  }

  const parsed = parse(initDataRaw);
  if (!parsed.user) return null;

  return {
    id: parsed.user.id,
    username: parsed.user.username,
  } as TelegramUserPayload;
}
