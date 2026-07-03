const { createClient } = require("redis");
const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
client.on("error", e => console.error("Redis error:", e.message));
async function main() {
  await client.connect();
  const dbsize = await client.dbSize();
  console.log("Total keys:", dbsize);
  // Sample key patterns
  const keys = await client.keys("*");
  const sample = keys.slice(0, 20);
  console.log("Sample keys:", sample);
  // Count by prefix
  const prefixes = {};
  for (const k of keys.slice(0, 1000)) {
    const prefix = k.split(":")[0];
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }
  console.log("Key prefixes (sample of 1000):", JSON.stringify(prefixes, null, 2));
  await client.quit();
}
main().catch(e => { console.error(e.message); process.exit(1); });
