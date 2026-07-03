import pg from "pg";

const { Client } = pg;

async function main() {
  const email = "randyortizalarcon@aoglobelife.com";
  const targetPending = 150;
  const allowedMarkets = ["globe market"];
  const allowedStates = [
    "AL", "AR", "AZ", "CA", "FL", "GA", "HI", "IL", "LA", "MD", "MI", "MN",
    "NC", "NE", "NJ", "NM", "OH", "OK", "OR", "SC", "SD", "TN", "TX", "UT",
    "VA", "VT", "WA", "WI", "WV", "IA", "IN", "KS", "KY", "PA", "AK", "NV",
  ];

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("BEGIN");

  try {
    // Remove any currently assigned rows that violate market/state rules.
    const nonMatching = await client.query(
      `
      SELECT id
      FROM masterlead
      WHERE lower(trim(coalesce(cn_email, ''))) = $1
        AND lower(trim(coalesce(cnresolution, ''))) IN ('pending', 'new', '')
        AND (
          lower(trim(coalesce(taalk_market, ''))) <> ALL($2::text[])
          OR upper(trim(coalesce(state, ''))) <> ALL($3::text[])
        )
      LIMIT 5000
      `,
      [email, allowedMarkets, allowedStates],
    );
    const badIds = nonMatching.rows.map((r) => r.id);
    let unassigned = 0;
    if (badIds.length > 0) {
      const unassignRes = await client.query(
        `
        UPDATE masterlead
        SET previous_cn_email = cn_email,
            cn_email = NULL,
            updated_at = NOW()
        WHERE id = ANY($1::bigint[])
        `,
        [badIds],
      );
      unassigned = unassignRes.rowCount || 0;
    }

    const beforeRes = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM masterlead
      WHERE lower(trim(coalesce(cn_email, ''))) = $1
        AND lower(trim(coalesce(cnresolution, ''))) IN ('pending', 'new', '')
      `,
      [email],
    );
    const beforePending = Number(beforeRes.rows[0]?.n || 0);
    const needed = Math.max(0, targetPending - beforePending);

    let assigned = 0;
    if (needed > 0) {
      const assignRes = await client.query(
        `
        WITH candidates AS (
          SELECT id
          FROM masterlead
          WHERE (cn_email IS NULL OR btrim(cn_email) = '')
            AND COALESCE(dnc::text, 'false') IN ('false', 'f', '0', '')
            AND COALESCE("TaalkResolve"::text, '') NOT IN ('true', '1')
            AND lower(trim(coalesce(taalk_market, ''))) = ANY($2::text[])
            AND upper(trim(coalesce(state, ''))) = ANY($3::text[])
            AND (
              cnresolution IS NULL
              OR lower(trim(cnresolution)) IN ('pending', 'new', '')
            )
          ORDER BY id ASC
          LIMIT $1
        )
        UPDATE masterlead m
        SET previous_cn_email = CASE
              WHEN m.cn_email IS NULL OR btrim(m.cn_email) = '' THEN m.previous_cn_email
              ELSE m.cn_email
            END,
            cn_email = $4,
            assigned_date = NOW(),
            updated_at = NOW()
        FROM candidates c
        WHERE m.id = c.id
        RETURNING m.id
        `,
        [needed, allowedMarkets, allowedStates, email],
      );
      assigned = assignRes.rowCount || 0;
    }

    const afterRes = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM masterlead
      WHERE lower(trim(coalesce(cn_email, ''))) = $1
        AND lower(trim(coalesce(cnresolution, ''))) IN ('pending', 'new', '')
      `,
      [email],
    );

    const breakdown = await client.query(
      `
      SELECT lower(trim(coalesce(taalk_market, ''))) AS market,
             upper(trim(coalesce(state, ''))) AS state,
             COUNT(*)::int AS n
      FROM masterlead
      WHERE lower(trim(coalesce(cn_email, ''))) = $1
        AND lower(trim(coalesce(cnresolution, ''))) IN ('pending', 'new', '')
      GROUP BY 1, 2
      ORDER BY n DESC, state ASC
      `,
      [email],
    );

    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        email,
        rules: { market: allowedMarkets, states: allowedStates },
        unassigned_nonmatching: unassigned,
        before_pending_after_cleanup: beforePending,
        assigned_matching: assigned,
        after_pending: Number(afterRes.rows[0]?.n || 0),
        breakdown: breakdown.rows,
      }),
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
