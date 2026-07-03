import { reconcileAgentDailyStatsForDate } from "../agent-daily-stats-reconciler";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const startIso = getArg("start") || "2026-04-01";
  const endIso =
    getArg("end") ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  let cur = toDate(startIso);
  const end = toDate(endIso);
  let days = 0;
  let totalUpserts = 0;

  while (cur <= end) {
    const day = isoDate(cur);
    const result = await reconcileAgentDailyStatsForDate(day);
    totalUpserts += result.upsertedRows;
    days += 1;
    console.log(
      `[reconcile-range] ${day} source_agents=${result.sourceAgents} upserted=${result.upsertedRows}`,
    );
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        start: startIso,
        end: endIso,
        days,
        totalUpserts,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
