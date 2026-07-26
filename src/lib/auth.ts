import 'server-only';
import {NextRequest} from 'next/server';
import {validateTelegramInitData} from '@/lib/telegram';
import {findUserByUsername} from '@/lib/db/users';
import {hasAnyRole} from '@/lib/roles';
import {User} from '@/types';

export interface AuthContext {
  TELEGRAM_USER: string;
  USER: User;
}

/**
 * Every API call from the client must include the raw Telegram
 * `initData` string in the `x-telegram-init-data` header (see
 * src/lib/apiClient.ts on the client side). We validate it against the
 * bot token, then look up the matching row in the "Users" sheet to get
 * the role(s). Returns null if invalid, unknown, or has none of the
 * allowed ROLES.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: string[]
): Promise<AuthContext | null> {
  const initData = req.headers.get('x-telegram-init-data');

  if (process.env.NODE_ENV !== 'production') {
    const ROLES = ['ADMIN', 'FLORIST', 'KURIR'];
    const USER = {
      USERNAME: 'DEV',
      NAME: 'DEV',
      ROLES,
    };
    return {TELEGRAM_USER: 'DEV', USER} as AuthContext;
  }

  if (!initData) return null;

  const telegramUser = validateTelegramInitData(initData);
  if (!telegramUser?.username) return null;

  const user = await findUserByUsername(telegramUser.username);
  if (!user) return null;

  const { ROLES } = user;
  if (allowedRoles && !hasAnyRole(ROLES, allowedRoles)) return null;

  return {TELEGRAM_USER: telegramUser.username, USER: user} as AuthContext;
}
