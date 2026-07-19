import { readSheet } from '@/lib/googleSheets';
import { User } from '@/types';

const SHEET_NAME = 'Users';

function normalizedUsername(username: string) {
  return username.replace(/^@/, '').toLowerCase();
}

export async function findUserByUsername(
  username: string
): Promise<User | null> {
  const users = await readSheet<User>(SHEET_NAME);
  const normalized = normalizedUsername(username);
  const found = users.find(
    (u) => normalizedUsername(u.USERNAME) === normalized
  );
  return found ?? null;
}
