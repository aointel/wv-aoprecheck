/**
 * TTL for cached lead position - prevents agents from using stale leads
 * after leaving computer on and returning when leads have been reassigned.
 */
export const POSITION_TTL_MS = 10 * 60 * 1000; // 10 minutes (leads reassign faster)

export function getPositionKey(email: string): string {
  return `call_connector_position_${email}`;
}

export function getPositionSavedAtKey(email: string): string {
  return `call_connector_position_saved_at_${email}`;
}

/** Restore position from localStorage, or 0 if expired/missing */
export function getRestoredPosition(userEmail: string | undefined): number {
  if (!userEmail || typeof window === 'undefined') return 0;
  try {
    const posKey = getPositionKey(userEmail);
    const savedAtKey = getPositionSavedAtKey(userEmail);
    const stored = localStorage.getItem(posKey);
    const savedAt = parseInt(localStorage.getItem(savedAtKey) || '0', 10);
    if (!stored) return 0;
    const age = Date.now() - savedAt;
    if (age > POSITION_TTL_MS) {
      localStorage.removeItem(posKey);
      localStorage.removeItem(savedAtKey);
      console.log(`⏰ POSITION EXPIRED: Cleared stale position (${Math.round(age / 60000)}m old)`);
      return 0;
    }
    const pos = parseInt(stored, 10);
    if (!Number.isNaN(pos) && pos >= 0) {
      console.log(`🔄 RESTORED POSITION: ${pos} for ${userEmail} (saved ${Math.round(age / 60000)}m ago)`);
      return pos;
    }
  } catch (error) {
    console.warn('Failed to restore position from localStorage:', error);
  }
  return 0;
}

/** Save position with timestamp for TTL check */
export function savePositionWithTTL(userEmail: string | undefined, position: number): void {
  if (!userEmail || typeof window === 'undefined' || position < 0) return;
  try {
    const posKey = getPositionKey(userEmail);
    const savedAtKey = getPositionSavedAtKey(userEmail);
    localStorage.setItem(posKey, position.toString());
    localStorage.setItem(savedAtKey, Date.now().toString());
  } catch (error) {
    console.warn('Failed to save position to localStorage:', error);
  }
}
