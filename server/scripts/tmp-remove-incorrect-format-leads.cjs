const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const CULPRIT_CTE = `
  WITH normalized AS (
    SELECT
      ml.id,
      ml.phone::text AS phone,
      ml.phone_last10::text AS phone_last10,
      REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g') AS phone_digits,
      REGEXP_REPLACE(COALESCE(ml.phone_last10::text, ''), '\\D', '', 'g') AS phone_last10_digits
    FROM masterlead ml
  ),
  flagged AS (
    SELECT
      n.id
    FROM normalized n
    WHERE
      CASE
        WHEN (CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END) = '' THEN true
        WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) < 10 THEN true
        WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) > 11 THEN true
        WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) = 11
             AND (CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END) NOT LIKE '1%' THEN true
        WHEN (
          CASE
            WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
            WHEN length(phone_digits) = 10 THEN phone_digits
            WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
            ELSE NULL
          END
        ) IS NULL THEN true
        WHEN (
          CASE
            WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
            WHEN length(phone_digits) = 10 THEN phone_digits
            WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
            ELSE NULL
          END
        ) ~ '^([0-9])\\1{9}$' THEN true
        WHEN (
          CASE
            WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
            WHEN length(phone_digits) = 10 THEN phone_digits
            WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
            ELSE NULL
          END
        ) IN ('1234567890','0123456789','0000000000','1111111111') THEN true
        WHEN (
          CASE
            WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
            WHEN length(phone_digits) = 10 THEN phone_digits
            WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
            ELSE NULL
          END
        ) !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' THEN true
        ELSE false
      END
  )
`;

async function run() {
  const apply = process.argv.includes("--apply");
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const preview = await client.query(`
      ${CULPRIT_CTE}
      SELECT
        (SELECT COUNT(*)::int FROM flagged) AS culprit_leads,
        (
          SELECT COUNT(*)::int
          FROM leasedialer_assignments la
          JOIN flagged f ON f.id = la.lead_id
          WHERE lower(COALESCE(la.status, '')) IN ('queued', 'active', 'assigned')
        ) AS assignments_to_release
    `);

    const output = {
      mode: apply ? "apply" : "dry-run",
      preview: preview.rows[0] || {},
      applied: false,
      marked_failed_rows: 0,
      released_rows: 0,
      queue_count_rows_updated: 0,
    };

    if (!apply) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    await client.query("BEGIN");

    const result = await client.query(`
      ${CULPRIT_CTE},
      marked AS (
        UPDATE masterlead ml
        SET
          cnresolution = 'failed',
          updated_at = NOW()
        FROM flagged f
        WHERE ml.id = f.id
          AND lower(trim(COALESCE(ml.cnresolution, ''))) NOT IN ('booked', 'sale')
        RETURNING ml.id
      ),
      released AS (
        UPDATE leasedialer_assignments la
        SET
          status = 'released',
          released_at = NOW(),
          release_reason = 'invalid_phone_format_cleanup',
          updated_at = NOW()
        FROM flagged f
        WHERE la.lead_id = f.id
          AND lower(COALESCE(la.status, '')) IN ('queued', 'active', 'assigned')
        RETURNING lower(la.agent_email) AS agent_email
      ),
      impacted AS (
        SELECT DISTINCT agent_email
        FROM released
        WHERE agent_email IS NOT NULL
      ),
      recalculated AS (
        UPDATE leasedialer_client_status lcs
        SET
          local_leased_lead_count = q.queued_count,
          updated_at = NOW()
        FROM (
          SELECT
            i.agent_email,
            COALESCE(COUNT(*) FILTER (WHERE la.status = 'queued'), 0)::int AS queued_count
          FROM impacted i
          LEFT JOIN leasedialer_assignments la
            ON lower(la.agent_email) = i.agent_email
          GROUP BY i.agent_email
        ) q
        WHERE lower(lcs.agent_email) = q.agent_email
        RETURNING lcs.agent_email
      )
      SELECT
        (SELECT COUNT(*)::int FROM marked) AS marked_failed_rows,
        (SELECT COUNT(*)::int FROM released) AS released_rows,
        (SELECT COUNT(*)::int FROM recalculated) AS queue_count_rows_updated
    `);

    await client.query("COMMIT");

    output.applied = true;
    output.marked_failed_rows = Number(result.rows[0]?.marked_failed_rows || 0);
    output.released_rows = Number(result.rows[0]?.released_rows || 0);
    output.queue_count_rows_updated = Number(result.rows[0]?.queue_count_rows_updated || 0);
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
