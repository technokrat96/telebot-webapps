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

export async function insertUser({ username, name, chatId, telegramId }: AppUserModel): Promise<User> {
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

export async function getTelegramIdByUsername(username: string): Promise<string | null> {
  const normalized = normalizedUsername(username);
  const user = await prisma.appUser.findFirst({
    where: { username: { contains: normalized, mode: 'insensitive' } },
    select: { telegramId: true },
  });
  return user?.telegramId ?? null;
}

/** Untuk dropdown "kirim ke" — semua staff yang sudah pernah login (punya telegramId). */
export async function listUsersWithTelegramId(): Promise<{ username: string; name: string }[]> {
  const rows = await prisma.appUser.findMany({
    where: { telegramId: { not: null } },
    select: { username: true, name: true },
  });
  return rows;
}