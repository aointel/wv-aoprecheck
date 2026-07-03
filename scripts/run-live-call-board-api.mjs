#!/usr/bin/env node
/**
 * Run the Live Call Board APIs (stats + agents) and print the response.
 * Usage: node scripts/run-live-call-board-api.mjs
 *        BASE_URL=https://aoirail-production.up.railway.app node scripts/run-live-call-board-api.mjs
 *        USER_EMAIL=your@email.com node scripts/run-live-call-board-api.mjs
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const USER_EMAIL = process.env.USER_EMAIL || 'cnsysop@aoglobelife.com';

const headers = {
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'x-user-email': USER_EMAIL,
};

async function get(path, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${label}: GET ${path}`);
  console.log('─'.repeat(60));
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers });
    const text = await res.text();
    if (!res.ok) {
      console.log(`Status: ${res.status} ${res.statusText}`);
      console.log(text);
      return null;
    }
    const data = JSON.parse(text);
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (e) {
    console.error('Error:', e.message);
    return null;
  }
}

async function main() {
  console.log('Live Call Board API');
  console.log('BASE_URL:', BASE_URL);
  console.log('x-user-email:', USER_EMAIL);

  await get('/api/live-call-board/stats?timePeriod=realtime', 'Stats');
  await get('/api/live-call-board/agents?timePeriod=realtime', 'Agents');

  console.log('\nDone.');
}

main();
