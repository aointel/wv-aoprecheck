const { createClient } = require("redis");
async function main() {
  for (let i = 0; i < 30; i++) {
    const client = createClient({ url: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@gondola.proxy.rlwy.net:56931" });
    client.on("error", () => {});
    try {
      await client.connect();
      const info = await client.info("persistence");
      const loading = info.match(/loading:(\d)/)?.[1];
      console.log(`Attempt ${i+1}: loading=${loading}`);
      if (loading === "0") {
        console.log("Redis ready — flushing all data...");
        await client.flushAll();
        console.log("FLUSHED. Setting maxmemory...");
        await client.configSet("maxmemory", "536870912");
        await client.configSet("maxmemory-policy", "allkeys-lru");
        await client.configRewrite();
        const size = await client.dbSize();
        console.log("Done. Keys after flush:", size);
        await client.quit();
        return;
      }
      await client.quit();
    } catch(e) {
      console.log(`Attempt ${i+1} failed: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 15000));
  }
}
main().catch(e => console.error(e.message));
