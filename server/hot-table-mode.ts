/**
 * Hot table write policy — EOD-only mode REMOVED.
 * All Supabase writes always enabled.
 */
export const HOT_TABLES_EOD_ONLY = false;

export function isHotTablesEodOnly(): boolean {
  return false;
}
