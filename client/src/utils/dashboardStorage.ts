const FAVORITES_KEY_PREFIX = 'dashboard-favorites-';
const RECENTS_KEY_PREFIX = 'dashboard-recents-';

function storageKey(prefix: string, email: string): string {
  const normalized = (email || 'unknown').trim().toLowerCase();
  return `${prefix}${normalized}`;
}

export function loadFavorites(email: string): string[] {
  try {
    const key = storageKey(FAVORITES_KEY_PREFIX, email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavorites(email: string, favorites: string[]): void {
  const key = storageKey(FAVORITES_KEY_PREFIX, email);
  localStorage.setItem(key, JSON.stringify(favorites));
}

export function loadRecents(email: string): string[] {
  try {
    const key = storageKey(RECENTS_KEY_PREFIX, email);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecents(email: string, recents: string[]): void {
  const key = storageKey(RECENTS_KEY_PREFIX, email);
  localStorage.setItem(key, JSON.stringify(recents));
}
