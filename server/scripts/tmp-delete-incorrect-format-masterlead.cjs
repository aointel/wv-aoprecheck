const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const CULPRIT_IDS_CTE = `
  WITH normalized AS (
    SELECT
      ml.id,
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
      ${CULPRIT_IDS_CTE}
      SELECT
        (SELECT COUNT(*)::int FROM flagged) AS culprit_leads,
        (
          SELECT COUNT(*)::int
          FROM leasedialer_assignments la
          JOIN flagged f ON f.id = la.lead_id
        ) AS assignments_linked
    `);

    const output = {
      mode: apply ? "apply" : "dry-run",
      preview: preview.rows[0] || {},
      applied: false,
      deleted_assignments: 0,
      deleted_masterlead_rows: 0,
    };

    if (!apply) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    await client.query("BEGIN");

    const result = await client.query(`
      ${CULPRIT_IDS_CTE},
      deleted_assignments AS (
        DELETE FROM leasedialer_assignments la
        USING flagged f
        WHERE la.lead_id = f.id
        RETURNING la.id
      ),
      deleted_masterlead AS (
        DELETE FROM masterlead ml
        USING flagged f
        WHERE ml.id = f.id
        RETURNING ml.id
      )
      SELECT
        (SELECT COUNT(*)::int FROM deleted_assignments) AS deleted_assignments,
        (SELECT COUNT(*)::int FROM deleted_masterlead) AS deleted_masterlead_rows
    `);

    await client.query("COMMIT");

    output.applied = true;
    output.deleted_assignments = Number(result.rows[0]?.deleted_assignments || 0);
    output.deleted_masterlead_rows = Number(result.rows[0]?.deleted_masterlead_rows || 0);
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
