const { createClient } = require("redis");
const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
client.on("error", e => console.error("Redis error:", e.message));
async function main() {
  await client.connect();
  const info = await client.info();
  const lines = info.split("\n").filter(l => 
    l.match(/used_memory_human|maxmemory_human|maxmemory_policy|redis_version|uptime_in_seconds|loading|rdb_bgsave_in_progress|aof_rewrite_in_progress|blocked_clients|connected_clients/)
  );
  lines.forEach(l => console.log(l.trim()));
  await client.quit();
}
main().catch(e => { console.error(e.message); process.exit(1); });
