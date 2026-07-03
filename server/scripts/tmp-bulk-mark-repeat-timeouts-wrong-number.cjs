const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TIMEOUT_STATUSES = ["no-answer", "no_answer", "failed"];

function getArg(name, fallback) {
  const prefixed = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!prefixed) return fallback;
  return prefixed.slice(name.length + 3);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function run() {
  const days = Math.max(1, Number(getArg("days", 7)) || 7);
  const minTimeouts = Math.max(2, Number(getArg("min-timeouts", 2)) || 2);
  const maxUpdates = Math.max(1, Number(getArg("max-updates", 1500)) || 1500);
  const sample = Math.max(1, Number(getArg("sample", 20)) || 20);
  const includeNoAnswer = hasFlag("include-no-answer");
  const apply = hasFlag("apply");
  const timeoutStatuses = includeNoAnswer ? TIMEOUT_STATUSES : ["failed"];

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const previewResult = await client.query(
      `
        WITH repeat_timeout_phones AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COUNT(*)::int AS timeout_count,
            MAX(t.call_started_at) AS last_timeout_at
          FROM twilio_call_logs t
          WHERE t.call_started_at >= NOW() - ($1::int * INTERVAL '1 day')
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(t.call_status, '')) = ANY($2::text[])
          GROUP BY 1
          HAVING length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
             AND COUNT(*) >= $3
        ),
        candidate_leads AS (
          SELECT
            ml.id AS lead_id,
            RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) AS phone10,
            rtp.timeout_count,
            rtp.last_timeout_at
          FROM masterlead ml
          JOIN repeat_timeout_phones rtp
            ON rtp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10)
          WHERE lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) <> ''
        )
        SELECT
          (SELECT COUNT(*)::int FROM repeat_timeout_phones) AS phones_meeting_rule,
          (SELECT COUNT(*)::int FROM candidate_leads) AS candidate_leads_to_mark,
          COALESCE(
            (
              SELECT json_agg(s)
              FROM (
                SELECT phone10, timeout_count, last_timeout_at
                FROM repeat_timeout_phones
                ORDER BY timeout_count DESC, last_timeout_at DESC
                LIMIT $4
              ) s
            ),
            '[]'::json
          ) AS sample_phones
      `,
      [days, timeoutStatuses, minTimeouts, sample],
    );

    const preview = previewResult.rows[0] || {};
    const candidateLeads = Number(preview.candidate_leads_to_mark || 0);
    const capped = candidateLeads > maxUpdates;

    const output = {
      mode: apply ? "apply" : "dry-run",
      rule: {
        days,
        min_timeouts: minTimeouts,
        statuses: timeoutStatuses,
      },
      safeguards: {
        pending_only: true,
        max_updates: maxUpdates,
      },
      preview: {
        phones_meeting_rule: Number(preview.phones_meeting_rule || 0),
        candidate_leads_to_mark: candidateLeads,
        would_be_capped: capped,
        sample_phones: preview.sample_phones || [],
      },
      applied: false,
      updated_rows: 0,
    };

    if (!apply) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (capped) {
      output.error = `Refusing to update ${candidateLeads} rows because max-updates=${maxUpdates}. Increase --max-updates if intended.`;
      console.log(JSON.stringify(output, null, 2));
      process.exitCode = 2;
      return;
    }

    await client.query("BEGIN");
    const updateResult = await client.query(
      `
        WITH repeat_timeout_phones AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs t
          WHERE t.call_started_at >= NOW() - ($1::int * INTERVAL '1 day')
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(t.call_status, '')) = ANY($2::text[])
          GROUP BY 1
          HAVING length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
             AND COUNT(*) >= $3
        )
        UPDATE masterlead ml
        SET
          cnresolution = 'wrong_number',
          updated_at = NOW()
        FROM repeat_timeout_phones rtp
        WHERE rtp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10)
          AND lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
      `,
      [days, timeoutStatuses, minTimeouts],
    );
    await client.query("COMMIT");

    output.applied = true;
    output.updated_rows = Number(updateResult.rowCount || 0);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
