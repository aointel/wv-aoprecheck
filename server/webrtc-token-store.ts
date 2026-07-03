/**
 * One token per user per server instance. Cleared on logout so they can get a new token.
 */
const lastTokenIssuedAtByUser = new Map<string, number>();
export const TOKEN_TTL_MS = 3600 * 1000; // 1 hour, match token ttl

export function canIssueToken(identity: string): boolean {
  const lastAt = lastTokenIssuedAtByUser.get(identity);
  if (lastAt == null) return true;
  return Date.now() - lastAt >= TOKEN_TTL_MS;
}

export function recordTokenIssued(identity: string): void {
  lastTokenIssuedAtByUser.set(identity, Date.now());
}

/** Call on logout so the user can get a new token when they log back in. */
export function clearTokenForLogout(email: string | null | undefined): void {
  if (!email || typeof email !== 'string' || !email.includes('@')) return;
  const identity = email.trim().toLowerCase();
  if (lastTokenIssuedAtByUser.delete(identity)) {
    console.log(`🔓 Cleared WebRTC token for logout: ${identity}`);
  }
}
