import {ROLES, UserRole} from '@/types';

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
