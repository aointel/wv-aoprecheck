/**
 * Shared AO Precheck team helpers (manager roster + confirmed members).
 */
import { randomUUID } from "crypto";
import { leaseDialerPool as teamPool } from "./db";

export function normTeamEmail(e = ""): string {
  return String(e).toLowerCase().trim();
}

let _teamTablesReady: Promise<void> | null = null;

export function ensureAoPrecheckTeamTables(): Promise<void> {
  if (_teamTablesReady) return _teamTablesReady;
  _teamTablesReady = (async () => {
    try {
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_teams (id text primary key, name text, manager_email text, created_at timestamptz default now())`);
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_team_members (team_id text, email text, added_at timestamptz default now(), primary key (team_id, email))`);
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_team_invites (id text primary key, email text, invited_by text, created_at timestamptz default now())`);
      await teamPool.query(`CREATE INDEX IF NOT EXISTS aoprecheck_teams_mgr_idx ON aoprecheck_teams (lower(manager_email))`);
      for (const tbl of ["aoprecheck_team_members", "aoprecheck_team_invites"]) {
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'pending'`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_token text`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirmed_at timestamptz`);
      }
      await teamPool.query(`ALTER TABLE aoprecheck_team_invites ADD COLUMN IF NOT EXISTS team_id text`);
      await teamPool.query(`UPDATE aoprecheck_team_members SET membership_status='confirmed' WHERE membership_status IS NULL`);
      await teamPool.query(`UPDATE aoprecheck_team_invites SET membership_status='confirmed' WHERE membership_status IS NULL`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[aoprecheck] ensureAoPrecheckTeamTables failed (non-fatal):", msg);
    }
  })();
  return _teamTablesReady;
}

/** Confirmed team member emails for a manager (includes manager's own email). */
export async function resolveManagerTeamEmails(manager: string): Promise<string[]> {
  await ensureAoPrecheckTeamTables();
  const mgr = normTeamEmail(manager);
  const emails = new Set<string>([mgr]);
  const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [mgr]);
  if (tr.rows[0]?.id) {
    const mr = await teamPool.query(
      `SELECT email FROM aoprecheck_team_members WHERE team_id=$1 AND membership_status='confirmed'`,
      [tr.rows[0].id],
    );
    (mr.rows || []).forEach((r: { email?: string }) => {
      const e = normTeamEmail(r.email || "");
      if (e) emails.add(e);
    });
  }
  return [...emails];
}

export function teamEmailOrFilter(emails: string[]): string {
  return emails.map((e) => `company_email.ilike.${normTeamEmail(e)}`).join(",");
}

export async function ensureManagerTeamId(manager: string, teamIdHint = ""): Promise<string> {
  let teamId = String(teamIdHint || "");
  if (teamId) return teamId;
  const mgr = normTeamEmail(manager);
  const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [mgr]);
  if (tr.rows[0]?.id) return String(tr.rows[0].id);
  teamId = randomUUID();
  await teamPool.query(`INSERT INTO aoprecheck_teams(id,name,manager_email) VALUES ($1,$2,$3)`, [teamId, `${mgr.split("@")[0]}'s team`, mgr]);
  return teamId;
}
