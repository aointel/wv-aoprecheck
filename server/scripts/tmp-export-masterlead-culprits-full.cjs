const fs = require("fs");
const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const { rows } = await client.query(`
      WITH normalized AS (
        SELECT
          ml.*,
          REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g') AS phone_digits,
          REGEXP_REPLACE(COALESCE(ml.phone_last10::text, ''), '\\D', '', 'g') AS phone_last10_digits
        FROM masterlead ml
      ),
      flagged AS (
        SELECT
          n.*,
          CASE
            WHEN (CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END) = '' THEN 'empty_phone'
            WHEN (CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END) !~ '^\\d+$' THEN 'non_numeric'
            WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) < 10 THEN 'too_short'
            WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) > 11 THEN 'too_long'
            WHEN length((CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END)) = 11
                 AND (CASE WHEN phone_digits <> '' THEN phone_digits WHEN phone_last10_digits <> '' THEN phone_last10_digits ELSE '' END) NOT LIKE '1%' THEN '11_digits_not_starting_1'
            WHEN (
              CASE
                WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
                WHEN length(phone_digits) = 10 THEN phone_digits
                WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
                ELSE NULL
              END
            ) ~ '^([0-9])\\1{9}$' THEN 'repeated_digit_placeholder'
            WHEN (
              CASE
                WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
                WHEN length(phone_digits) = 10 THEN phone_digits
                WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
                ELSE NULL
              END
            ) IN ('1234567890','0123456789','0000000000','1111111111') THEN 'sequence_placeholder'
            WHEN (
              CASE
                WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
                WHEN length(phone_digits) = 10 THEN phone_digits
                WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
                ELSE NULL
              END
            ) IS NULL THEN 'cannot_normalize_to_10'
            WHEN (
              CASE
                WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
                WHEN length(phone_digits) = 10 THEN phone_digits
                WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
                ELSE NULL
              END
            ) !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' THEN 'invalid_nanp_shape'
            ELSE NULL
          END AS format_issue
        FROM normalized n
      )
      SELECT *
      FROM flagged
      WHERE format_issue IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outJson = `server/scripts/reports/masterlead-incorrect-full-rows-${stamp}.json`;
    fs.writeFileSync(outJson, JSON.stringify(rows, null, 2), "utf8");

    console.log(
      JSON.stringify(
        {
          totalRows: rows.length,
          reportJson: outJson,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
