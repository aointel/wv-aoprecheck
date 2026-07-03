/**
 * Pause all Globe / VN campaigns in Taalk by setting limitPerHour = 0.
 *
 * Usage:
 *   npx tsx server/scripts/pause-globe-vn-campaigns.ts
 *   npx tsx server/scripts/pause-globe-vn-campaigns.ts --db=michaelmandella
 *
 * Optional env:
 *   TAALK_API_KEY=...
 *   TAALK_DB=...
 */

type Campaign = {
  _id?: string;
  id?: string;
  name?: string;
  limitPerHour?: number;
  [key: string]: unknown;
};

const DEFAULT_DB = process.env.TAALK_DB || "michaelmandella";
const API_KEY =
  process.env.TAALK_API_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function isGlobeOrVnCampaign(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (!n) return false;
  if (n.includes("globe")) return true;
  // Match common VN campaign naming patterns (VN125, vn-*, *-vn*, etc)
  if (/\bvn\d*\b/i.test(name)) return true;
  if (/vn[-_ ]/i.test(name) || /[-_ ]vn/i.test(name)) return true;
  return false;
}

async function fetchAllCampaigns(db: string): Promise<Campaign[]> {
  const all: Campaign[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `https://api.taalk.ai/api/campaign2s?db=${encodeURIComponent(db)}&page=${page}&limit=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed listing campaigns page ${page}: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { payload?: Campaign[]; total?: number };
    const payload = json.payload || [];
    all.push(...payload);
    const total = json.total || all.length;
    const perPage = payload.length || 20;
    totalPages = Math.max(1, Math.ceil(total / perPage));
    page += 1;
    if (page <= totalPages) await new Promise((r) => setTimeout(r, 150));
  } while (page <= totalPages);
  return all;
}

async function pauseCampaign(db: string, id: string): Promise<void> {
  const url = `https://api.taalk.ai/api/campaign2s/${id}?db=${encodeURIComponent(db)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limitPerHour: 0 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

async function main() {
  const db = getArg("db") || DEFAULT_DB;
  if (!API_KEY) throw new Error("Missing TAALK_API_KEY");

  console.log(`\n🛑 Pausing Globe/VN campaigns (db=${db})...`);
  const all = await fetchAllCampaigns(db);
  const targets = all.filter((c) => isGlobeOrVnCampaign(String(c.name || "")));

  console.log(`📋 Total campaigns: ${all.length}`);
  console.log(`🎯 Globe/VN targets: ${targets.length}\n`);

  let ok = 0;
  let fail = 0;
  const failed: Array<{ id: string; name: string; error: string }> = [];

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i];
    const id = String(c._id || c.id || "");
    const name = String(c.name || "(unnamed)");
    if (!id) {
      fail += 1;
      failed.push({ id: "(missing)", name, error: "Missing campaign id" });
      console.log(`❌ [${i + 1}/${targets.length}] ${name} -> missing id`);
      continue;
    }
    try {
      await pauseCampaign(db, id);
      ok += 1;
      console.log(`✅ [${i + 1}/${targets.length}] ${name} (${id}) -> limitPerHour=0`);
    } catch (e: any) {
      fail += 1;
      const msg = e?.message || String(e);
      failed.push({ id, name, error: msg });
      console.log(`❌ [${i + 1}/${targets.length}] ${name} (${id}) -> ${msg}`);
    }
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n📊 Done. paused=${ok}, failed=${fail}`);
  if (failed.length) {
    console.log("\nFailed campaigns:");
    for (const f of failed) {
      console.log(`- ${f.name} (${f.id}): ${f.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("❌ Script failed:", e?.message || e);
  process.exit(1);
});

