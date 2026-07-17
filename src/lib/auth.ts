import { NextRequest } from 'next/server';
import { validateTelegramInitData } from '@/lib/telegram';
import { findUserByUsername } from '@/lib/sheets/users';
import { hasAnyRole, parseRoles } from '@/lib/roles';
import { AppUser, UserRole } from '@/types';

export interface AuthContext {
  telegramUsername: string;
  user: AppUser;
  /** Parsed from user.ROLE — a user can hold more than one role. */
  roles: UserRole[];
}

/**
 * Every API call from the client must include the raw Telegram
 * `initData` string in the `x-telegram-init-data` header (see
 * src/lib/apiClient.ts on the client side). We validate it against the
 * bot token, then look up the matching row in the "Users" sheet to get
 * the role(s). Returns null if invalid, unknown, or has none of the
 * allowed roles.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthContext | null> {
  const initData = req.headers.get('x-telegram-init-data');
  if (!initData) return null;

  const telegramUser = validateTelegramInitData(initData);
  if (!telegramUser?.username) return null;

  const user = await findUserByUsername(telegramUser.username);
  if (!user) return null;

  const roles = parseRoles(user.ROLE);
  if (allowedRoles && !hasAnyRole(roles, allowedRoles)) return null;

  return { telegramUsername: telegramUser.username, user, roles };
}
