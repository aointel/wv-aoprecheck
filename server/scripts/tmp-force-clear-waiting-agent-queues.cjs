const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Math.min(180, Number(process.argv[2] || 30)));
  const limit = Math.max(1, Math.min(300, Number(process.argv[3] || 200)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      WITH waiting AS (
        SELECT lower(agent_email) AS agent_email
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          AND COALESCE(local_leased_lead_count, 0) = 0
        GROUP BY lower(agent_email)
        ORDER BY lower(agent_email)
        LIMIT $2
      ),
      updated AS (
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'manual_force_clear_waiting_agents',
            updated_at = NOW()
        FROM waiting w
        WHERE lower(la.agent_email) = w.agent_email
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
        RETURNING lower(la.agent_email) AS agent_email
      )
      SELECT agent_email, COUNT(*)::int AS removed_rows
      FROM updated
      GROUP BY agent_email
      ORDER BY removed_rows DESC, agent_email ASC
      `
      ,
      [minutes, limit],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          windowMinutes: minutes,
          waitingLimit: limit,
          agentsAffected: result.rows.length,
          totalRowsRemoved: result.rows.reduce((sum, row) => sum + Number(row.removed_rows || 0), 0),
          rows: result.rows,
        },
        null,
        2,
      ),
    );
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
