import { isHotTablesEodOnly } from "./hot-table-mode";

let bypassCounter = 0;

const HOT_TABLE_PATHS = [
  "/rest/v1/twilio_call_logs",
  "/rest/v1/agent_dial_metrics",
];
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isWithinEodHour(now = new Date()): boolean {
  return now.getHours() === 23;
}

export function shouldBlockHotTableSupabaseWrite(
  url: string,
  method: string,
): boolean {
  if (!isHotTablesEodOnly()) return false;
  const upperMethod = method.toUpperCase();
  if (READ_METHODS.has(upperMethod)) return false;
  if (!HOT_TABLE_PATHS.some((path) => url.includes(path))) return false;
  if (bypassCounter > 0) return false;
  if (isWithinEodHour()) return false;
  return true;
}

export async function withHotTableSupabaseWriteBypass<T>(
  fn: () => Promise<T>,
): Promise<T> {
  bypassCounter += 1;
  try {
    return await fn();
  } finally {
    bypassCounter = Math.max(0, bypassCounter - 1);
  }
}
