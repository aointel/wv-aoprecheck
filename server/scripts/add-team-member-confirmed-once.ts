/**
 * One-off: add a team member as confirmed (bypass email confirmation).
 * Usage: npx tsx server/scripts/add-team-member-confirmed-once.ts <managerEmail> <memberEmail>
 */
import { randomUUID } from "crypto";
import { leaseDialerPool as pool } from "../db";

const MANAGER = (process.argv[2] || "chrislafond@aoglobelife.com").trim().toLowerCase();
const AGENT = (process.argv[3] || "austinrockall@aoglobelife.com").trim().toLowerCase();

async function main() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS aoprecheck_teams (id text primary key, name text, manager_email text, created_at timestamptz default now())`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS aoprecheck_team_members (team_id text, email text, added_at timestamptz default now(), primary key (team_id, email))`,
  );
  for (const tbl of ["aoprecheck_team_members", "aoprecheck_team_invites"]) {
    await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_token text`);
    await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz`);
    await pool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirmed_at timestamptz`);
  }

  let tr = await pool.query(`SELECT id,name FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [MANAGER]);
  let teamId = tr.rows[0]?.id as string | undefined;
  if (!teamId) {
    teamId = randomUUID();
    await pool.query(`INSERT INTO aoprecheck_teams(id,name,manager_email) VALUES ($1,$2,$3)`, [
      teamId,
      `${MANAGER.split("@")[0]}'s team`,
      MANAGER,
    ]);
    console.log("Created team", teamId);
  } else {
    console.log("Found team", teamId, tr.rows[0].name);
  }

  const before = await pool.query(
    `SELECT email, membership_status, confirmed_at FROM aoprecheck_team_members WHERE team_id=$1 AND lower(email)=lower($2)`,
    [teamId, AGENT],
  );
  console.log("Before:", before.rows);

  await pool.query(
    `INSERT INTO aoprecheck_team_members(team_id,email,membership_status,confirmed_at,confirm_token)
     VALUES ($1,$2,'confirmed',now(),NULL)
     ON CONFLICT (team_id,email) DO UPDATE SET
       membership_status='confirmed',
       confirmed_at=COALESCE(aoprecheck_team_members.confirmed_at, now()),
       confirm_token=NULL`,
    [teamId, AGENT],
  );

  await pool.query(
    `DELETE FROM aoprecheck_team_invites WHERE lower(email)=lower($1) AND (team_id=$2 OR lower(invited_by)=lower($3))`,
    [AGENT, teamId, MANAGER],
  ).catch(() => {});

  const after = await pool.query(
    `SELECT email, membership_status, confirmed_at FROM aoprecheck_team_members WHERE team_id=$1 ORDER BY email`,
    [teamId],
  );
  console.log("Team members:", after.rows);
  console.log(`Done: ${AGENT} on ${MANAGER}'s team as confirmed`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
