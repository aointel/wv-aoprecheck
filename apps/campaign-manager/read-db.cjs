const dbPath = process.argv[2] || 'C:/ProgramData/eApp/AIL/PROD/Sales/721c0fa8-c811-4a49-97ca-a6066014fcbe.db';
const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(r => r.name).join(', '));
for (const { name } of tables) {
  const cols = db.prepare(`PRAGMA table_info(${name})`).all();
  const count = db.prepare(`SELECT count(*) as c FROM ${name}`).get();
  console.log(`\n${name} (${count.c} rows):`, cols.map(c => c.name).join(', '));
  const sample = db.prepare(`SELECT * FROM ${name} LIMIT 3`).all();
  console.log(JSON.stringify(sample, null, 2));
}
db.close();
