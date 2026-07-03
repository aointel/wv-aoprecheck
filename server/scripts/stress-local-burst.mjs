const base = process.env.STRESS_URL || "http://127.0.0.1:5001";
async function runPool(total, conc, fn) {
  let next = 0;
  const worker = async () => {
    for (;;) {
      const id = next++;
      if (id >= total) break;
      await fn(id);
    }
  };
  await Promise.all(Array.from({ length: conc }, () => worker()));
}
function pct(arr, p) {
  if (!arr.length) return 0;
  return arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
}
async function main() {
  const healthN = Number(process.env.HEALTH_N || 3000);
  const healthC = Number(process.env.HEALTH_C || 150);
  const incN = Number(process.env.INC_N || 150);
  const incC = Number(process.env.INC_C || 50);
  const lat = [];
  const t0 = performance.now();
  let ok = 0, fail = 0;
  await runPool(healthN, healthC, async () => {
    const a = performance.now();
    try {
      const r = await fetch(`${base}/api/health`);
      lat.push(performance.now() - a);
      if (r.ok) ok++; else fail++;
    } catch { fail++; }
  });
  lat.sort((x, y) => x - y);
  console.log(`[health] ${healthN} req ${healthC} conc ${(performance.now() - t0).toFixed(0)}ms ok=${ok} fail=${fail} p50=${pct(lat,50).toFixed(0)} p95=${pct(lat,95).toFixed(0)} max=${lat.at(-1)?.toFixed(0)}`);
  ok = 0; fail = 0;
  const lat2 = [];
  let enqueue = 0;
  const t1 = performance.now();
  await runPool(incN, incC, async (id) => {
    const a = performance.now();
    const body = new URLSearchParams({
      CallSid: `STburst${id}x${Date.now()}`,
      From: `+1555${String(1000000 + (id % 1000000)).padStart(7, "0")}`,
      To: "+16096048379",
    });
    try {
      const r = await fetch(`${base}/incomingcall`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      lat2.push(performance.now() - a);
      const text = await r.text();
      if (r.ok && text.includes("Enqueue")) enqueue++;
      if (r.ok) ok++; else fail++;
    } catch { fail++; }
  });
  lat2.sort((x, y) => x - y);
  console.log(`[incomingcall] ${incN} req ${incC} conc ${(performance.now() - t1).toFixed(0)}ms ok=${ok} fail=${fail} Enqueue=${enqueue} p50=${pct(lat2,50).toFixed(0)} p95=${pct(lat2,95).toFixed(0)} max=${lat2.at(-1)?.toFixed(0)}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
