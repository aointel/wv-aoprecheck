const { Pool } = require("pg");
const { mkdirSync, writeFileSync } = require("fs");
const { dirname } = require("path");

const pool = new Pool({
  connectionString:
    "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  max: 3,
});

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function run() {
  const statDate = process.argv[2] || "2026-04-20";
  const outPath =
    process.argv[3] ||
    `C:\\dev\\AOIrail\\server\\scripts\\output\\agent-daily-stats-${statDate}.csv`;

  const { rows } = await pool.query(
    `
      SELECT
        agent_email,
        stat_date,
        dials,
        reached,
        booked,
        instants,
        sales,
        alp,
        plus,
        updated_at
      FROM agent_daily_stats
      WHERE stat_date = $1::date
      ORDER BY dials DESC, reached DESC, booked DESC, agent_email ASC
    `,
    [statDate],
  );

  const header = [
    "agent_email",
    "stat_date",
    "dials",
    "reached",
    "booked",
    "instants",
    "sales",
    "alp",
    "plus",
    "updated_at",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.agent_email,
        row.stat_date,
        row.dials,
        row.reached,
        row.booked,
        row.instants,
        row.sales,
        row.alp,
        row.plus,
        row.updated_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        statDate,
        rows: rows.length,
        outPath,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error(err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
