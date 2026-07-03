/**
 * One token per user per server instance.
 * Clear a user's slot when they close the tab so they can get a new token when they return.
 */
export const lastTokenIssuedAtByUser = new Map<string, number>();
export const TOKEN_TTL_MS = 3600 * 1000; // 1 hour, match token ttl

export function releaseTokenSlot(identity: string): void {
  const email = identity?.trim?.()?.toLowerCase?.();
  if (email) {
    lastTokenIssuedAtByUser.delete(email);
  }
}

export function hasActiveToken(identity: string): boolean {
  const email = identity?.trim?.()?.toLowerCase?.();
  if (!email) return false;
  const lastAt = lastTokenIssuedAtByUser.get(email);
  return lastAt != null && Date.now() - lastAt < TOKEN_TTL_MS;
}

export function setTokenIssued(identity: string): void {
  const email = identity?.trim?.()?.toLowerCase?.();
  if (email) lastTokenIssuedAtByUser.set(email, Date.now());
}
