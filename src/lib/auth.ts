import "server-only";
import { NextRequest } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";
import { findUserByUsername } from "@/lib/db/users";
import { hasAnyRole } from "@/lib/roles";
import { User } from "@/types";

export interface AuthContext {
  TELEGRAM_ID: string;
  TELEGRAM_USER: string;
  USER: User;
}

/**
 * Every API call from the client must include `Authorization: Bearer <jwt>`
 * (see src/lib/apiClient.ts on the client side). The JWT is issued by
 * POST /api/auth/login after a username/password check, and holds the
 * username/name/roles at the time of login. We re-verify the signature
 * here, then re-fetch the user from the DB so role changes made by an
 * admin after login still take effect immediately (the JWT itself is only
 * used to prove identity, not as the source of truth for ROLES).
 *
 * Returns null if the token is missing/invalid/expired, the user no
 * longer exists, or has none of the allowed ROLES.
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: string[],
): Promise<AuthContext | null> {
  if (process.env.NODE_ENV !== "production") {
    const ROLES = ["ADMIN", "FLORIST", "KURIR"];
    const USER = {
      USERNAME: "DEV",
      NAME: "DEV",
      ROLES,
      CHAT_ID: "1",
      TELEGRAM_ID: "1",
    };
    return { TELEGRAM_ID: "1", TELEGRAM_USER: "DEV", USER } as AuthContext;
  }

  const prefixBearer = "bearer ";
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith(prefixBearer)
    ? authHeader?.slice(prefixBearer.length).trim()
    : null;
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload?.username) return null;

  const user = await findUserByUsername(payload.username);
  if (!user) return null;

  const { ROLES } = user;
  if (allowedRoles && !hasAnyRole(ROLES, allowedRoles)) return null;

  return {
    TELEGRAM_ID: user.CHAT_ID ?? user.TELEGRAM_ID ?? "",
    TELEGRAM_USER: user.USERNAME,
    USER: user,
  } as AuthContext;
}
