/**
 * Inbound agent ring order per (market, state).
 * Maintains rotation: get next agent in line; on answer or no-answer, move to bottom.
 * Used with 3s sequential ring for queue delivery.
 */

const INBOUND_RING_ORDER_KEY = (market: string, state: string) =>
  `${String(market).trim().toLowerCase()}|${String(state).trim().toUpperCase()}`;

// Ordered list of agent emails per (market, state). First in list gets the next ring.
const orderByKey: Map<string, string[]> = new Map();

// Simple lock per key to avoid concurrent corruption when updating order.
const locks: Map<string, Promise<void>> = new Map();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let prev = locks.get(key);
  const p = (async () => {
    await prev;
    try {
      return await fn();
    } finally {
      if (locks.get(key) === p) locks.delete(key);
    })();
  });
  locks.set(key, p as Promise<void>);
  return p;
}

/**
 * Get a copy of the current ring order for (market, state). Empty if never initialized.
 */
export function getOrderedList(market: string, state: string): string[] {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  const list = orderByKey.get(key);
  return list ? [...list] : [];
}

/**
 * Set the ring order for (market, state) only if not already set (or empty).
 * Used to initialize from DB-built list sorted by distribution_priority.
 */
export function setOrderIfEmpty(market: string, state: string, emails: string[]): void {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  const existing = orderByKey.get(key);
  if (!existing || existing.length === 0) {
    const normalized = emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
    orderByKey.set(key, [...normalized]);
    if (normalized.length > 0) {
      console.log(`📞 Inbound ring order: initialized ${key} with ${normalized.length} agents`);
    }
  }
}

/**
 * Overwrite the ring order for (market, state). Use when rebuilding (e.g. periodic refresh).
 */
export function setOrder(market: string, state: string, emails: string[]): void {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  const normalized = emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  orderByKey.set(key, [...normalized]);
}

/**
 * Peek the first agent in ring order for (market, state). Does not remove.
 */
export function getNextInOrder(market: string, state: string): string | null {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  const list = orderByKey.get(key);
  return list && list.length > 0 ? list[0] : null;
}

/**
 * Move agent to the end of the ring order for (market, state).
 * Call on answer or no-answer so they get the next ring after others.
 */
export function moveToBottom(email: string, market: string, state: string): void {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  const list = orderByKey.get(key);
  if (!list || list.length <= 1) return;
  const normalized = String(email).toLowerCase().trim();
  const idx = list.findIndex((e) => e.toLowerCase() === normalized);
  if (idx < 0) return;
  const removed = list.splice(idx, 1)[0];
  list.push(removed);
  console.log(`📞 Inbound ring order: moved ${removed} to bottom for ${key}`);
}

/**
 * Get the next agent to ring: first in order who is in the eligible set.
 * If the first is not eligible, move them to bottom and repeat (so we don't block on offline agents).
 * Returns null if no one in the list is eligible.
 * Uses lock for concurrent safety per (market, state).
 */
export async function getNextAgent(
  market: string,
  state: string,
  eligibleSet: Set<string>,
  excludeRinging?: Set<string>
): Promise<string | null> {
  const key = INBOUND_RING_ORDER_KEY(market, state);
  return withLock(key, async () => {
    let list = orderByKey.get(key);
    if (!list || list.length === 0) return null;
    const exclude = new Set([...(excludeRinging || [])].map((e) => e.toLowerCase()));
    const eligible = new Set([...eligibleSet].map((e) => e.toLowerCase()));
    const maxIterations = list.length;
    for (let i = 0; i < maxIterations; i++) {
      const first = list[0];
      if (!first) break;
      const firstLow = first.toLowerCase();
      if (eligible.has(firstLow) && !exclude.has(firstLow)) return first;
      moveToBottom(first, market, state);
      list = orderByKey.get(key)!;
    }
    return null;
  });
}
