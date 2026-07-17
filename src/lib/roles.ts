import {ROLES, UserRole} from '@/types';

/**
 * Parses the raw ROLE cell from the "Users" sheet into a list of roles.
 * Accepts one or many roles separated by comma, semicolon, slash, or
 * pipe, in any case: "ADMIN", "ADMIN, FLORIST", "admin/florist", etc.
 * Unknown tokens are silently dropped.
 */
export function parseRoles(raw: string): UserRole[] {
  return raw
    .split(/[,;/|]+/)
    .map((r) => r.trim().toUpperCase())
    .filter((r): r is UserRole => (ROLES as string[]).includes(r));
}

/** True if the user has at least one of the allowed roles. */
export function hasAnyRole(userRoles: UserRole[], allowed: UserRole[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}
