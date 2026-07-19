export function parseRoles(ROLES: string[], raw: string): string[] {
  return raw
    .split(/[,;/|]+/)
    .map((r) => r.trim().toUpperCase())
    .filter((r): r is string => ROLES.includes(r));
}

/** True if the user has at least one of the allowed roles. */
export function hasAnyRole(userRoles: string[], allowed: string[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}
