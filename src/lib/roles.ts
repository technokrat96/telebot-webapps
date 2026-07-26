/** True if the USER has at least one of the allowed ROLES. */
export function hasAnyRole(userRoles: string[], allowed: string[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}
