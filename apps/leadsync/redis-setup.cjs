const { createClient } = require("redis");
async function main() {
  const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
  client.on("error", e => console.error(e.message));
  await client.connect();
  const info = await client.info("persistence");
  const loading = info.match(/loading:(\d)/)?.[1];
  console.log("loading:", loading);
  const dbsize = await client.dbSize();
  console.log("keys:", dbsize);
  const mem = await client.info("memory");
  console.log("memory:", mem.match(/used_memory_human:.+/)?.[0]);
  // Set limits
  await client.configSet("maxmemory", "536870912");
  await client.configSet("maxmemory-policy", "allkeys-lru");
  // Persist config so it survives restarts
  try { await client.configRewrite(); } catch(e) { console.log("configRewrite not supported (ok)"); }
  console.log("maxmemory set to 512MB, policy=allkeys-lru");
  await client.quit();
}
main().catch(e => console.error(e.message));
