async function main() {
  const host = "https://aoirail-production.up.railway.app";
  const idx = await (await fetch(`${host}/`)).text();
  const matches = [...idx.matchAll(/\/assets\/index-[^"']+\.js/g)].map((m) => m[0]);
  const jsPath = matches[matches.length - 1];
  if (!jsPath) {
    console.log("NO_BUNDLE");
    return;
  }
  const js = await (await fetch(`${host}${jsPath}`)).text();
  console.log(
    JSON.stringify(
      {
        host,
        bundle: jsPath,
        hasDbgOverlay: js.includes("DBG api="),
        hasAoQueueDebug: js.includes("AO QUEUE DEBUG: hotLeads"),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
