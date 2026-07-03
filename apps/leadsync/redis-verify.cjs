const { createClient } = require("redis");
async function main() {
  const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
  client.on("error", e => console.error(e.message));
  await client.connect();
  const info = await client.info();
  const lines = info.split("\n").filter(l => l.match(/used_memory_human|maxmemory_human|maxmemory_policy|loading|uptime/));
  lines.forEach(l => console.log(l.trim()));
  const dbsize = await client.dbSize();
  console.log("keys:", dbsize);
  await client.quit();
}
main().catch(e => console.error(e.message));
