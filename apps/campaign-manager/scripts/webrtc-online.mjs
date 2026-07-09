#!/usr/bin/env node
/**
 * Print agents online right now on WebRTC (Twilio Sync). No server needed.
 * Usage: node scripts/webrtc-online.mjs
 * Uses TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN (and optional TWILIO_SYNC_SERVICE_SID) from env or .env.
 */

import 'dotenv/config';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'b275d646252457344ff62528e3538ea9';
const mapName = process.env.TWILIO_SYNC_MAP_NAME || 'agent_presence';

async function getSyncServiceSid(client) {
  if (process.env.TWILIO_SYNC_SERVICE_SID?.trim()) return process.env.TWILIO_SYNC_SERVICE_SID.trim();
  const services = await client.sync.v1.services.list({ limit: 20 });
  if (services[0]) return services[0].sid;
  const created = await client.sync.v1.services.create({ friendlyName: 'TaalkCenterTracker Presence' });
  return created.sid;
}

async function main() {
  if (!accountSid || !authToken) {
    console.error('Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (or add to .env)');
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  let serviceSid;
  try {
    serviceSid = await getSyncServiceSid(client);
  } catch (err) {
    console.error('Twilio Sync service:', err.message);
    process.exit(1);
  }

  let maps = await client.sync.v1.services(serviceSid).syncMaps.list({ limit: 100 });
  let mapResource = maps.find((m) => m.uniqueName === mapName);
  if (!mapResource) {
    await client.sync.v1.services(serviceSid).syncMaps.create({ uniqueName: mapName });
    maps = await client.sync.v1.services(serviceSid).syncMaps.list({ limit: 100 });
    mapResource = maps.find((m) => m.uniqueName === mapName);
    if (mapResource) console.log('Created Sync map "%s".', mapName);
  }
  if (!mapResource) {
    console.error('Could not create or find map "%s".', mapName);
    process.exit(1);
  }

  const items = await client.sync.v1
    .services(serviceSid)
    .syncMaps(mapResource.sid)
    .syncMapItems.list({ limit: 500 });

  const presence = items.map((item) => ({
    key: item.key,
    ...(typeof item.data === 'object' && item.data !== null ? item.data : {}),
  }));

  const online = presence.filter((p) => p.status !== 'offline' && p.status !== undefined);
  const available = online.filter((p) => p.status === 'available');
  const onCall = online.filter((p) => p.status === 'on_call');

  console.log('--- WebRTC agents right now (Twilio Sync) ---');
  console.log('Map:', mapName, '| Total items:', presence.length);
  console.log('');

  if (online.length === 0) {
    console.log('No agents online on WebRTC.');
    if (presence.length === 0) console.log('(Map is empty — agent app must write to Sync when they go online.)');
    process.exit(0);
  }

  console.log('AVAILABLE:', available.length);
  available.forEach((p) => {
    const extra = [p.market, p.states?.length ? p.states.join(',') : ''].filter(Boolean).join(' | ');
    console.log('   ', p.key, extra ? `| ${extra}` : '');
  });

  console.log('');
  console.log('ON CALL:', onCall.length);
  onCall.forEach((p) => {
    const dir = p.callDirection || '';
    const extra = [p.market, p.states?.length ? p.states.join(',') : ''].filter(Boolean).join(' | ');
    console.log('   ', p.key, dir ? `| ${dir}` : '', extra ? `| ${extra}` : '');
  });

  console.log('');
  console.log('Total online:', online.length);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
