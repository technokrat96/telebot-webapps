import 'server-only';
import jwt from 'jsonwebtoken';

// Sesi login username/password berlaku 30 hari (internal staff tool, jarang
// perlu login ulang). Ganti di sini kalau kebijakan berubah.
const JWT_EXPIRES_IN = '30d';

export interface AuthTokenPayload {
  username: string;
  name: string;
  roles: string[];
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET env var');
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (typeof decoded === 'string') return null;
    const { username, name, roles } = decoded as Partial<AuthTokenPayload> & jwt.JwtPayload;
    if (!username || !name || !Array.isArray(roles)) return null;
    return { username, name, roles };
  } catch {
    return null;
  }
}
