const { createClient } = require("redis");
async function poll() {
  const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
  client.on("error", () => {});
  try {
    await client.connect();
    const info = await client.info("persistence");
    const loading = info.match(/loading:(\d)/)?.[1];
    const pct = info.match(/loading_loaded_perc:([\d.]+)/)?.[1];
    const eta = info.match(/loading_eta_seconds:(\d+)/)?.[1];
    console.log(`loading=${loading} pct=${pct}% eta=${eta}s`);
    if (loading === "0") {
      const dbsize = await client.dbSize();
      console.log("READY. Total keys:", dbsize);
    }
    await client.quit();
  } catch(e) {
    console.log("Not ready:", e.message);
  }
}
poll();
