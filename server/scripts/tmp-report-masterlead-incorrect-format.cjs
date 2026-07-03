const fs = require("fs");
const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const q = await client.query(`
      WITH ml AS (
        SELECT
          ml.id,
          ml.phone::text AS phone,
          ml.phone_last10::text AS phone_last10,
          ml.cnresolution,
          ml.cn_email,
          ml.updated_at,
          REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g') AS phone_digits,
          REGEXP_REPLACE(COALESCE(ml.phone_last10::text, ''), '\\D', '', 'g') AS phone_last10_digits
        FROM masterlead ml
      ),
      normalized AS (
        SELECT
          ml.*,
          CASE
            WHEN phone_digits <> '' THEN phone_digits
            WHEN phone_last10_digits <> '' THEN phone_last10_digits
            ELSE ''
          END AS source_digits,
          CASE
            WHEN length(phone_digits) = 11 AND phone_digits LIKE '1%' THEN right(phone_digits, 10)
            WHEN length(phone_digits) = 10 THEN phone_digits
            WHEN phone_digits = '' AND length(phone_last10_digits) = 10 THEN phone_last10_digits
            ELSE NULL
          END AS canonical10
        FROM ml
      ),
      flagged AS (
        SELECT
          n.*,
          CASE
            WHEN source_digits = '' THEN 'empty_phone'
            WHEN source_digits !~ '^\\d+$' THEN 'non_numeric'
            WHEN length(source_digits) < 10 THEN 'too_short'
            WHEN length(source_digits) > 11 THEN 'too_long'
            WHEN length(source_digits) = 11 AND source_digits NOT LIKE '1%' THEN '11_digits_not_starting_1'
            WHEN canonical10 IS NULL THEN 'cannot_normalize_to_10'
            WHEN canonical10 ~ '^([0-9])\\1{9}$' THEN 'repeated_digit_placeholder'
            WHEN canonical10 IN ('1234567890','0123456789','0000000000','1111111111') THEN 'sequence_placeholder'
            WHEN canonical10 !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' THEN 'invalid_nanp_shape'
            ELSE NULL
          END AS format_issue
        FROM normalized n
      ),
      with_queue AS (
        SELECT
          f.*,
          EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = f.id
              AND lower(COALESCE(la.status, '')) IN ('queued','active','assigned')
          ) AS currently_in_queue
        FROM flagged f
      )
      SELECT
        id,
        phone,
        phone_last10,
        source_digits,
        canonical10,
        format_issue,
        cnresolution,
        cn_email,
        currently_in_queue,
        updated_at
      FROM with_queue
      WHERE format_issue IS NOT NULL
      ORDER BY currently_in_queue DESC, updated_at DESC NULLS LAST
    `);

    const rows = q.rows || [];
    const byReason = {};
    let queueCount = 0;
    let pendingLikeCount = 0;
    for (const r of rows) {
      byReason[r.format_issue] = (byReason[r.format_issue] || 0) + 1;
      if (r.currently_in_queue) queueCount += 1;
      const s = String(r.cnresolution || "").trim().toLowerCase();
      if (!s || s === "pending" || s === "new" || s === "called") pendingLikeCount += 1;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outCsv = `server/scripts/reports/masterlead-incorrect-format-${stamp}.csv`;
    const outJson = `server/scripts/reports/masterlead-incorrect-format-${stamp}.json`;

    const header = [
      "id",
      "phone",
      "phone_last10",
      "source_digits",
      "canonical10",
      "format_issue",
      "cnresolution",
      "cn_email",
      "currently_in_queue",
      "updated_at",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.phone,
          r.phone_last10,
          r.source_digits,
          r.canonical10,
          r.format_issue,
          r.cnresolution,
          r.cn_email,
          r.currently_in_queue,
          r.updated_at,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    fs.writeFileSync(outCsv, lines.join("\n"), "utf8");

    const summary = {
      generatedAtUtc: new Date().toISOString(),
      totalIncorrectMasterleadRows: rows.length,
      incorrectRowsCurrentlyInQueue: queueCount,
      incorrectRowsPendingLike: pendingLikeCount,
      byReason,
      reportCsv: outCsv,
    };
    fs.writeFileSync(outJson, JSON.stringify(summary, null, 2), "utf8");

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
