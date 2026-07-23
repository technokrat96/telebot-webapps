import { prisma } from '@/lib/prismaClient';
import { User } from '@/types';

function normalizedUsername(username: string) {
  return username.replace(/^@/, '').toLowerCase();
}

function toUser(row: { username: string; name: string; roles: { role: string }[] }): User {
  return { USERNAME: row.username, NAME: row.name, ROLES: row.roles.map(e => e.role).join(', ') };
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
        contains: normalized,
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