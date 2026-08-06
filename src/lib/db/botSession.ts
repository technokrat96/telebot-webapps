import 'server-only';
import {prisma} from '@/lib/prismaClient';

/**
 * State percakapan bot Telegram per chat, dipakai buat flow inline keyboard
 * multi-langkah (Register User / Edit User) yang butuh input teks di
 * tengah flow (mis. "ketik username yang mau didaftarkan").
 *
 * Kenapa raw SQL, bukan lewat Prisma Client model biasa? Sandbox
 * development ini tidak bisa `prisma generate` / `prisma db push` (network
 * ke binaries.prisma.sh diblokir), jadi tabel `bot_session` di-provision
 * sendiri lewat `CREATE TABLE IF NOT EXISTS` saat pertama dipakai. Model
 * `BotSession` tetap didefinisikan di prisma/schema.prisma supaya begitu
 * `npm run db:push` dijalankan di environment yang punya akses network,
 * schema-nya tetap konsisten (idempotent, tabel sudah ada jadi no-op).
 */

export type BotSessionState =
  | 'AWAIT_REG_USERNAME'
  | 'SELECT_REG_ROLES'
  | 'AWAIT_CHK_USERNAME'
  | 'CHECKED_USER'
  | 'SELECT_EDIT_ROLES'
  | 'CONFIRM_DELETE';

export type BotSessionData = {
  username?: string;
  roles?: string[];
};

export type BotSession = {
  state: BotSessionState;
  data: BotSessionData;
};

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS bot_session (
      chat_id VARCHAR(50) PRIMARY KEY,
      state VARCHAR(40) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  tableEnsured = true;
}

export async function getBotSession(chatId: string): Promise<BotSession | null> {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ state: string; data: BotSessionData }[]>`
    SELECT state, data FROM bot_session WHERE chat_id = ${chatId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {state: row.state as BotSessionState, data: row.data ?? {}};
}

export async function setBotSession(
  chatId: string,
  state: BotSessionState,
  data: BotSessionData = {},
): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`
    INSERT INTO bot_session (chat_id, state, data, updated_at)
    VALUES (${chatId}, ${state}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (chat_id) DO UPDATE
      SET state = EXCLUDED.state, data = EXCLUDED.data, updated_at = now()
  `;
}

export async function clearBotSession(chatId: string): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`DELETE FROM bot_session WHERE chat_id = ${chatId}`;
}
