const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const active = await client.query(
      `
      SELECT
        now() AS ts,
        pid,
        usename,
        application_name,
        state,
        wait_event_type,
        wait_event,
        client_addr,
        backend_start,
        query_start,
        now() - query_start AS runtime,
        left(regexp_replace(query, '\\s+', ' ', 'g'), 300) AS query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
      ORDER BY query_start ASC
      LIMIT 80
      `,
    );

    const blocking = await client.query(
      `
      SELECT
        blocked.pid AS blocked_pid,
        blocker.pid AS blocker_pid,
        blocked.usename AS blocked_user,
        blocker.usename AS blocker_user,
        blocked.wait_event_type,
        blocked.wait_event,
        now() - blocked.query_start AS blocked_for,
        left(regexp_replace(blocked.query, '\\s+', ' ', 'g'), 220) AS blocked_query,
        left(regexp_replace(blocker.query, '\\s+', ' ', 'g'), 220) AS blocker_query
      FROM pg_locks bl
      JOIN pg_stat_activity blocked
        ON blocked.pid = bl.pid
      JOIN pg_locks kl
        ON kl.locktype = bl.locktype
       AND kl.database IS NOT DISTINCT FROM bl.database
       AND kl.relation IS NOT DISTINCT FROM bl.relation
       AND kl.page IS NOT DISTINCT FROM bl.page
       AND kl.tuple IS NOT DISTINCT FROM bl.tuple
       AND kl.virtualxid IS NOT DISTINCT FROM bl.virtualxid
       AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
       AND kl.classid IS NOT DISTINCT FROM bl.classid
       AND kl.objid IS NOT DISTINCT FROM bl.objid
       AND kl.objsubid IS NOT DISTINCT FROM bl.objsubid
       AND kl.pid <> bl.pid
      JOIN pg_stat_activity blocker
        ON blocker.pid = kl.pid
      WHERE NOT bl.granted
        AND kl.granted
      ORDER BY blocked.query_start ASC
      LIMIT 40
      `,
    );

    let topStatements = { rows: [], note: null };
    try {
      topStatements = await client.query(
        `
        SELECT
          calls,
          total_exec_time,
          mean_exec_time,
          rows,
          left(regexp_replace(query, '\\s+', ' ', 'g'), 240) AS query
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 25
        `,
      );
    } catch (error) {
      topStatements = { rows: [], note: "pg_stat_statements unavailable" };
    }

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          activeCount: active.rows.length,
          active: active.rows,
          blockingCount: blocking.rows.length,
          blocking: blocking.rows,
          topStatementsCount: topStatements.rows.length,
          topStatements: topStatements.rows,
          topStatementsNote: topStatements.note || null,
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
