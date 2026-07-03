const https = require("https");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body });
        });
      })
      .on("error", reject);
  });
}

async function run() {
  const base = "https://aoirail-connect-production.up.railway.app";
  const html = await get(`${base}/`);
  const scripts = Array.from(html.body.matchAll(/<script[^>]+src=\"([^\"]+)\"/g)).map((m) => m[1]);
  const assets = scripts.filter((src) => src.includes("/assets/"));
  const hits = [];
  for (const src of assets.slice(0, 20)) {
    const js = await get(`${base}${src}`);
    const hasSync = js.body.includes("/api/leasedialer/sync");
    const hasLeadsLease = js.body.includes("/api/outbound-dialer/leads?") && js.body.includes("lease=1");
    if (hasSync || hasLeadsLease) {
      hits.push({ asset: src, hasSync, hasLeadsLease });
    }
  }
  console.log(
    JSON.stringify(
      {
        indexStatus: html.status,
        scriptCount: assets.length,
        hits,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

