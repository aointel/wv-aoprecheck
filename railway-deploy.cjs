/**
 * Direct Railway GraphQL deploy — bypasses CLI auth issues.
 * Uses the access token from config.json to trigger serviceInstanceRedeploy.
 */
const https = require('https');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('C:\\Users\\mmand\\.railway\\config.json', 'utf8'));
const TOKEN = config.user.accessToken;
const ENV_ID = '9ff049ad-dfba-462b-a3a7-eaf678e31900';

// Service IDs to deploy
const SERVICES = [
  { name: 'aoirail-connect',      id: '0587609a-024f-41fd-a576-103e9c5c9004' },
  { name: 'aoirail-data',         id: '26f6600c-0b7a-4422-bf6c-942757b114f1' },
  { name: 'aoirail-leadsync',     id: '5e63d60e-7e78-4fea-8eee-17ec5baf5487' },
  { name: 'campaginmanager',      id: null }, // will find by name
];

async function gql(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function listServices() {
  const r = await gql(`
    query { project(id: "20b8d382-8b91-417b-98bb-c113ae727d49") { services { edges { node { id name } } } } }
  `);
  return r?.data?.project?.services?.edges?.map(e => e.node) || [];
}

async function redeploy(serviceId, serviceName) {
  const r = await gql(`
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `, { serviceId, environmentId: ENV_ID });
  if (r.errors) {
    console.error(`❌ ${serviceName}: ${r.errors.map(e => e.message).join(', ')}`);
  } else {
    console.log(`✅ ${serviceName}: redeployed`);
  }
}

async function main() {
  console.log('Listing services...');
  const services = await listServices();
  console.log('Services:', services.map(s => `${s.name} (${s.id})`).join('\n  '));

  for (const svc of SERVICES) {
    let id = svc.id;
    if (!id) {
      const found = services.find(s => s.name.toLowerCase().includes(svc.name.toLowerCase()));
      if (!found) { console.warn(`⚠️ ${svc.name}: not found`); continue; }
      id = found.id;
    }
    await redeploy(id, svc.name);
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);
