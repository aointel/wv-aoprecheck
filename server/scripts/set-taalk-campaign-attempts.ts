/**
 * Bulk update Taalk campaigns to a fixed attempts value.
 *
 * Usage:
 *   npx tsx server/scripts/set-taalk-campaign-attempts.ts
 *   npx tsx server/scripts/set-taalk-campaign-attempts.ts --attempts=12 --db=michaelmandella
 *
 * Optional env:
 *   TAALK_API_KEY=...
 *   TAALK_DB=...
 */

const DEFAULT_ATTEMPTS = 12;
const DEFAULT_DB = process.env.TAALK_DB || "michaelmandella";
const DEFAULT_API_KEY =
  process.env.TAALK_API_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

type Campaign = {
  _id?: string;
  id?: string;
  name?: string;
  attempts?: number;
  maxAttempts?: number;
  max_attempts?: number;
  [key: string]: unknown;
};

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function pickAttemptsField(c: Campaign): "attempts" | "maxAttempts" | "max_attempts" {
  if (typeof c.attempts !== "undefined") return "attempts";
  if (typeof c.maxAttempts !== "undefined") return "maxAttempts";
  if (typeof c.max_attempts !== "undefined") return "max_attempts";
  return "attempts";
}

async function fetchAllCampaigns(db: string, apiKey: string): Promise<Campaign[]> {
  const campaigns: Campaign[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `https://api.taalk.ai/api/campaign2s?db=${encodeURIComponent(db)}&page=${page}&limit=100`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch campaigns page ${page}: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { payload?: Campaign[]; total?: number };
    const payload = json.payload || [];
    campaigns.push(...payload);

    const total = json.total || campaigns.length;
    const perPage = payload.length || 20;
    totalPages = Math.max(1, Math.ceil(total / perPage));
    page += 1;

    if (page <= totalPages) {
      await new Promise((r) => setTimeout(r, 150));
    }
  } while (page <= totalPages);

  return campaigns;
}

async function updateCampaignAttempts(
  db: string,
  apiKey: string,
  campaignId: string,
  field: "attempts" | "maxAttempts" | "max_attempts",
  attempts: number,
): Promise<void> {
  const url = `https://api.taalk.ai/api/campaign2s/${campaignId}?db=${encodeURIComponent(db)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ [field]: attempts }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
}

async function main() {
  const attemptsArg = getArg("attempts");
  const attempts = Number.isFinite(Number(attemptsArg)) ? Number(attemptsArg) : DEFAULT_ATTEMPTS;
  const db = getArg("db") || DEFAULT_DB;
  const apiKey = DEFAULT_API_KEY;

  if (!apiKey) {
    throw new Error("TAALK_API_KEY is required.");
  }
  if (!Number.isFinite(attempts) || attempts < 0) {
    throw new Error(`Invalid attempts value: ${attempts}`);
  }

  console.log(`\n🔧 Setting Taalk campaign attempts to ${attempts}`);
  console.log(`🗄️  DB: ${db}\n`);

  const campaigns = await fetchAllCampaigns(db, apiKey);
  console.log(`📋 Found ${campaigns.length} campaigns\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < campaigns.length; i++) {
    const c = campaigns[i];
    const id = String(c._id || c.id || "");
    const name = String(c.name || "(unnamed)");
    if (!id) {
      failed += 1;
      console.log(`❌ [${i + 1}/${campaigns.length}] Missing campaign id: ${name}`);
      continue;
    }

    const field = pickAttemptsField(c);
    try {
      await updateCampaignAttempts(db, apiKey, id, field, attempts);
      ok += 1;
      console.log(`✅ [${i + 1}/${campaigns.length}] ${name} (${id}) -> ${field}=${attempts}`);
    } catch (error: any) {
      failed += 1;
      console.log(`❌ [${i + 1}/${campaigns.length}] ${name} (${id}) -> ${error?.message || error}`);
    }

    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log("\n📊 Done");
  console.log(`✅ Updated: ${ok}`);
  console.log(`❌ Failed:  ${failed}\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("❌ Script failed:", error?.message || error);
  process.exit(1);
});

