const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const emails = process.argv
    .slice(2)
    .map((v) => String(v || "").trim().toLowerCase())
    .filter((v) => v.includes("@"));
  if (emails.length === 0) {
    throw new Error("Usage: node server/scripts/tmp-reset-agent-queues.cjs <email1> [email2 ...]");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const released = await client.query(
      `
      UPDATE leasedialer_assignments
      SET status = 'released',
          released_at = NOW(),
          release_reason = 'manual_callable_reset',
          updated_at = NOW()
      WHERE queue = 'hotlead'
        AND status IN ('queued', 'active')
        AND lower(agent_email) = ANY($1::text[])
      RETURNING lower(agent_email) AS agent_email
      `,
      [emails],
    );

    const byAgent = {};
    for (const row of released.rows) {
      byAgent[row.agent_email] = (byAgent[row.agent_email] || 0) + 1;
    }

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          emails,
          released_total: Number(released.rowCount || 0),
          by_agent: byAgent,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
