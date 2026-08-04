import 'server-only';
import {prisma} from '@/lib/prismaClient';
import {User} from '@/types';
import {AppUserModel} from "@/generated/prisma/models/AppUser";
import {UserRoleModel} from "@/generated/prisma/models/UserRole";

function normalizedUsername(username: string) {
  return username.replace(/^@/, '').toLowerCase();
}

function toUser(row: AppUserModel & { roles: Omit<UserRoleModel, "username">[] }): User {
  return {
    CHAT_ID: row.chatId,
    TELEGRAM_ID: row.telegramId,
    USERNAME: row.username,
    NAME: row.name,
    ROLES: row.roles.map(e => e.role),
  };
}

export async function findUserByUsername(
  username: string
): Promise<User | null> {
  const normalized = normalizedUsername(username);
  // Data Users biasanya kecil (puluhan/ratusan baris), jadi ambil semua
  // lalu bandingkan case-insensitive persis seperti perilaku lama.
  const user = await prisma.appUser.findFirst({
    where: {
      username: {
        equals: normalized,
        mode: 'insensitive',
      },
    },
    include: {
      roles: {
        select: {
          role: true, // 💡 Hanya mengambil kolom role dari database
        }
      },
    }
  });
  return user ? toUser(user) : null;
}

/**
 * Dipakai khusus alur otentikasi: login username/password (perlu hash
 * password) dan halaman /telegram-setup (perlu tahu apakah password sudah
 * pernah di-set). Tidak lewat `toUser` supaya hash password tidak pernah
 * ikut ter-expose ke response API lain secara tidak sengaja.
 */
export async function findUserAuthByUsername(username: string): Promise<
  (AppUserModel & { roles: Omit<UserRoleModel, 'username'>[] }) | null
> {
  const normalized = normalizedUsername(username);
  return prisma.appUser.findFirst({
    where: {
      username: {
        equals: normalized,
        mode: 'insensitive',
      },
    },
    include: {
      roles: {
        select: { role: true },
      },
    },
  });
}

export async function setUserPassword(username: string, passwordHash: string): Promise<void> {
  const normalized = normalizedUsername(username);
  await prisma.appUser.updateMany({
    where: { username: { equals: normalized, mode: 'insensitive' } },
    data: { password: passwordHash },
  });
}

export async function findUsersAdminNotMeAndHasChatIdOrTelegramId(username: string): Promise<User[]> {
  const user = await prisma.appUser.findMany({
    take: 2,
    orderBy: {
      username: "asc",
    },
    where: {
      username: {
        not: username,
      },
      roles: {
        some: {
          role: {
            in: ['ADMIN']
          }
        }
      },
      OR: [
        { chatId: { not: null } },
        { telegramId: { not: null } }
      ]
    },
    include: {
      roles: {
        select: {
          role: true,
        }
      },
    }
  });

  return user.map(toUser);
}

export async function updateUserByUsername(username: string, {
  name,
  telegramId,
  chatId,
}: Partial<AppUserModel>): Promise<void> {
  const normalized = normalizedUsername(username);
  const data: Partial<AppUserModel> = {};
  if (telegramId) data.telegramId = telegramId;
  if (chatId) data.chatId = chatId;
  if (name) data.name = name;
  await prisma.appUser.updateMany({
    where: { username: { contains: normalized, mode: 'insensitive' } },
    data,
  });
}

export async function insertUser({ username, name, chatId, telegramId }: Pick<AppUserModel, 'username' | 'name' | 'chatId' | 'telegramId'>): Promise<User> {
  const user = await prisma.appUser.create({
    data: {
      username,
      name,
      chatId,
      telegramId
    },
  });

  return toUser({ ...user, roles: [] });
}

export async function insertRoleUser(username: string, role: string): Promise<void> {
  await prisma.userRole.create({
    data: {
      username,
      role,
    },
  });
}

export async function getTelegramIdByUsername(username: string) {
  const normalized = normalizedUsername(username);
  const user = await prisma.appUser.findFirst({
    where: { username: { contains: normalized, mode: 'insensitive' } },
  });
  return user;
}

/** Untuk dropdown "kirim ke" — semua staff yang sudah pernah login (punya telegramId). */
export async function listUsersWithTelegramId(): Promise<{ username: string; name: string }[]> {
  const rows = await prisma.appUser.findMany({
    where: {
      OR: [
        { telegramId: { not: null } },
        { chatId: { not: null } },
      ]
    },
    select: { username: true, name: true },
  });
  return rows;
}

/** Untuk dropdown "assign ke florist/kurir" di halaman detail transaksi admin. */
export async function listUsersByRole(role: string): Promise<{ username: string; name: string }[]> {
  const rows = await prisma.appUser.findMany({
    where: {
      roles: {
        some: { role },
      },
    },
    orderBy: { name: 'asc' },
    select: { username: true, name: true },
  });
  return rows;
}