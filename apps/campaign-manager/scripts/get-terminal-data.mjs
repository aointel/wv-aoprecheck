#!/usr/bin/env node
/**
 * Fetch agent data directly from AOI Rail and Twilio. No server needed.
 * Uses AOIRAIL_BASE (or default URL) and Twilio Account SID + Auth Token.
 */

import 'dotenv/config';
import twilio from 'twilio';

const AOI_BASE = process.env.AOIRAIL_BASE || 'https://aoirail-production-baa2.up.railway.app';
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'b275d646252457344ff62528e3538ea9';
const mapName = process.env.TWILIO_SYNC_MAP_NAME || 'agent_presence';

async function main() {
  console.log('=== AOI RAIL ===');
  const aoiAgentsUrl = `${AOI_BASE.replace(/\/$/, '')}/api/twilio-task-route/agents`;
  const aoiStatusUrl = `${AOI_BASE.replace(/\/$/, '')}/api/twilio-task-route/status`;
  try {
    const [agentsRes, statusRes] = await Promise.all([
      fetch(aoiAgentsUrl, { headers: { Accept: 'application/json' } }),
      fetch(aoiStatusUrl, { headers: { Accept: 'application/json' } }),
    ]);
    const agentsText = await agentsRes.text();
    const statusText = await statusRes.text();
    let agentsData, statusData;
    try {
      agentsData = JSON.parse(agentsText);
    } catch {
      agentsData = agentsText;
    }
    try {
      statusData = JSON.parse(statusText);
    } catch {
      statusData = statusText;
    }
    console.log('GET', aoiAgentsUrl);
    console.log('  status:', agentsRes.status);
    console.log('  body:', JSON.stringify(agentsData, null, 2));
    console.log('');
    console.log('GET', aoiStatusUrl);
    console.log('  status:', statusRes.status);
    console.log('  body:', JSON.stringify(statusData, null, 2));
  } catch (e) {
    console.log('  error:', e.message);
  }

  console.log('\n=== TWILIO SYNC (WebRTC presence) ===');
  if (!accountSid || !authToken) {
    console.log('  No Twilio creds');
    return;
  }
  const client = twilio(accountSid, authToken);
  let serviceSid;
  try {
    if (process.env.TWILIO_SYNC_SERVICE_SID?.trim()) {
      serviceSid = process.env.TWILIO_SYNC_SERVICE_SID.trim();
    } else {
      const services = await client.sync.v1.services.list({ limit: 20 });
      serviceSid = services[0] ? services[0].sid : null;
      if (!serviceSid) {
        const created = await client.sync.v1.services.create({ friendlyName: 'TaalkCenterTracker Presence' });
        serviceSid = created.sid;
      }
    }
  } catch (e) {
    console.log('  Sync service error:', e.message);
    return;
  }
  const maps = await client.sync.v1.services(serviceSid).syncMaps.list({ limit: 100 });
  const mapResource = maps.find((m) => m.uniqueName === mapName);
  if (!mapResource) {
    console.log('  Map "%s" not found', mapName);
    return;
  }
  const items = await client.sync.v1
    .services(serviceSid)
    .syncMaps(mapResource.sid)
    .syncMapItems.list({ limit: 500 });
  const presence = items.map((item) => ({ key: item.key, data: item.data }));
  console.log('  serviceSid:', serviceSid);
  console.log('  map:', mapName, '| items:', presence.length);
  console.log('  body:', JSON.stringify(presence, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
