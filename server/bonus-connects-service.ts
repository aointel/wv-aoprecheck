import fs from "fs/promises";
import path from "path";

const BONUS_CONNECTS_MAX_DEFAULT = 10;
const BONUS_CONNECTS_FILE = path.join(process.cwd(), "server", "data", "bonus-connects.json");

interface BonusConnectUserState {
  remaining: number;
  max: number;
  reset_key: string;
  consumed_call_sids: string[];
}

interface BonusConnectStore {
  users: Record<string, BonusConnectUserState>;
}

export interface BonusConnectSnapshot {
  bonus_connects_remaining: number;
  bonus_connects_max: number;
  reset_key: string;
}

function getResetKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function ensureStoreFile(): Promise<void> {
  await fs.mkdir(path.dirname(BONUS_CONNECTS_FILE), { recursive: true });
  try {
    await fs.access(BONUS_CONNECTS_FILE);
  } catch {
    const initial: BonusConnectStore = { users: {} };
    await fs.writeFile(BONUS_CONNECTS_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<BonusConnectStore> {
  await ensureStoreFile();
  try {
    const raw = await fs.readFile(BONUS_CONNECTS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      users: typeof parsed?.users === "object" && parsed.users ? parsed.users : {},
    };
  } catch {
    return { users: {} };
  }
}

async function writeStore(store: BonusConnectStore): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(BONUS_CONNECTS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normalizeUserState(
  existing: BonusConnectUserState | undefined,
  now = new Date(),
): BonusConnectUserState {
  const resetKey = getResetKey(now);
  const base: BonusConnectUserState = existing ?? {
    remaining: BONUS_CONNECTS_MAX_DEFAULT,
    max: BONUS_CONNECTS_MAX_DEFAULT,
    reset_key: resetKey,
    consumed_call_sids: [],
  };

  if (base.reset_key !== resetKey) {
    return {
      remaining: base.max || BONUS_CONNECTS_MAX_DEFAULT,
      max: base.max || BONUS_CONNECTS_MAX_DEFAULT,
      reset_key: resetKey,
      consumed_call_sids: [],
    };
  }

  return {
    remaining: Math.max(0, Number(base.remaining ?? BONUS_CONNECTS_MAX_DEFAULT)),
    max: Math.max(1, Number(base.max ?? BONUS_CONNECTS_MAX_DEFAULT)),
    reset_key: base.reset_key || resetKey,
    consumed_call_sids: Array.isArray(base.consumed_call_sids) ? base.consumed_call_sids.filter(Boolean).slice(-100) : [],
  };
}

export async function getBonusConnectSnapshot(email: string): Promise<BonusConnectSnapshot> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const store = await readStore();
  const state = normalizeUserState(store.users[normalizedEmail]);
  if (normalizedEmail) {
    store.users[normalizedEmail] = state;
    await writeStore(store);
  }
  return {
    bonus_connects_remaining: state.remaining,
    bonus_connects_max: state.max,
    reset_key: state.reset_key,
  };
}

export async function consumeBonusConnect(email: string, callSid?: string | null): Promise<BonusConnectSnapshot & { consumed: boolean }> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCallSid = String(callSid || "").trim();
  const store = await readStore();
  const state = normalizeUserState(store.users[normalizedEmail]);

  let consumed = false;
  if (normalizedCallSid && state.consumed_call_sids.includes(normalizedCallSid)) {
    // idempotent
  } else if (state.remaining > 0) {
    state.remaining -= 1;
    consumed = true;
    if (normalizedCallSid) {
      state.consumed_call_sids = [...state.consumed_call_sids, normalizedCallSid].slice(-100);
    }
  }

  store.users[normalizedEmail] = state;
  await writeStore(store);

  return {
    bonus_connects_remaining: state.remaining,
    bonus_connects_max: state.max,
    reset_key: state.reset_key,
    consumed,
  };
}
