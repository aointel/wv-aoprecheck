const { createClient } = require("redis");
const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
client.on("error", e => console.error("Redis error:", e.message));
async function main() {
  await client.connect();
  // Set 512MB max memory with LRU eviction
  await client.configSet("maxmemory", "536870912");
  await client.configSet("maxmemory-policy", "allkeys-lru");
  // Verify
  const maxmem = await client.configGet("maxmemory");
  const policy = await client.configGet("maxmemory-policy");
  console.log("maxmemory:", maxmem);
  console.log("maxmemory-policy:", policy);
  await client.quit();
}
main().catch(e => { console.error(e.message); process.exit(1); });
