const { Client } = require("pg");

async function main() {
  const url = process.env.DATABASE_URL || process.env.MASTERLEAD_DATABASE_URL;
  if (!url) {
    console.error("NO_DB_URL");
    process.exit(2);
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const email = "chrislafond@aoglobelife.com";

  const rows = await client.query(
    `
      select
        coalesce(lower(trim(cnresolution)), '<<null>>') as resolution,
        count(*)::int as count
      from masterlead
      where lower(trim(coalesce(cn_email, ''))) = $1
      group by 1
      order by 2 desc
    `,
    [email]
  );

  const total = await client.query(
    `
      select count(*)::int as total
      from masterlead
      where lower(trim(coalesce(cn_email, ''))) = $1
    `,
    [email]
  );

  console.log(JSON.stringify({ total: total.rows[0].total, breakdown: rows.rows }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
