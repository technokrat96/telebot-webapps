import { readSheet } from '@/lib/googleSheets';
import { AppUser } from '@/types';

const SHEET_NAME = 'Users';

export async function findUserByUsername(
  username: string
): Promise<AppUser | null> {
  const users = await readSheet<AppUser>(SHEET_NAME);
  const normalized = username.replace(/^@/, '').toLowerCase();
  const found = users.find(
    (u) => u.USERNAME?.replace(/^@/, '').toLowerCase() === normalized
  );
  return found ?? null;
}
