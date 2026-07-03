const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toCsvValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

async function run() {
  const outDir = path.join(__dirname, "output");
  const outPath = path.join(outDir, `masterlead-full-${stamp()}.csv`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 0,
    query_timeout: 0,
  });

  await client.connect();
  try {
    const result = await client.query("SELECT * FROM masterlead");
    const columns = result.fields.map((field) => field.name);
    const header = columns.join(",");
    const body = result.rows.map((row) => columns.map((column) => toCsvValue(row[column])).join(","));
    fs.writeFileSync(outPath, [header, ...body].join("\n"), "utf8");

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          rows: result.rowCount,
          outputCsv: outPath,
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
