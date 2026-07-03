/**
 * AO Intel - Active Users Daily Report
 * Mailed daily to michaelmandella@aoglobelife.com, CameronSims@aoglobelife.com, richiealtig@aoglobelife.com
 * Sorted: active CCPro first, then active logins in last 30 days
 */
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { createClient } from '@supabase/supabase-js';
import { pool } from './db.js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './hardcoded-config.js';

const MAILGUN_API_KEY = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';
const MAILGUN_DOMAIN = 'mg.connectnow.one';
const REPORT_TO = [
  'michaelmandella@aoglobelife.com',
  'CameronSims@aoglobelife.com',
  'richiealtig@aoglobelife.com',
  'mmandella@ailpdx.com',
];

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface AgentRow {
  email: string;
  name: string;
  market: string;
  states: string;
  ccpro: boolean;
  aoiconnect: string;
  last_heartbeat: string | null;
  dials_today: number;
  dials_30d: number;
  reached_today: number;
  booked_today: number;
  last_login: string | null;
}

async function buildReport(): Promise<AgentRow[]> {
  // 1. Pull all customers from Supabase
  let allCustomers: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, first_name, last_name, market, states, CCPRO, AOICONNECT')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allCustomers = allCustomers.concat(data);
    if (data.length < pageSize) break;
  }

  // 2. Pull live call status
  const { data: liveStatus } = await supabaseAdmin
    .from('agent_live_call_status')
    .select('agent_email, status, last_heartbeat_at');
  const liveMap = new Map((liveStatus || []).map((r: any) => [r.agent_email?.toLowerCase(), r]));

  // 3. Pull today + 30d stats from Neon
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  const { rows: statsRows } = await pool.query(`
    SELECT
      agent_email,
      SUM(dials) FILTER (WHERE stat_date::date = $1::date)::int AS dials_today,
      SUM(reached) FILTER (WHERE stat_date::date = $1::date)::int AS reached_today,
      SUM(booked) FILTER (WHERE stat_date::date = $1::date)::int AS booked_today,
      SUM(dials) FILTER (WHERE stat_date::date >= $2::date)::int AS dials_30d,
      MAX(stat_date) AS last_active_date
    FROM agent_daily_stats
    WHERE stat_date::date >= $2::date
    GROUP BY agent_email
  `, [today, thirtyDaysAgoStr]);

  const statsMap = new Map(statsRows.map((r: any) => [r.agent_email?.toLowerCase(), r]));

  // 4. Build rows — only include agents active in last 30 days OR CCPRO active
  const rows: AgentRow[] = [];
  const seen = new Set<string>();

  for (const c of allCustomers) {
    const email = String(c.company_email || c.personal_email || '').toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const live = liveMap.get(email);
    const stats = statsMap.get(email);
    const ccpro = c.CCPRO === true || c.CCPRO === 'true';
    const aoiconnect = String(c.AOICONNECT || '').toUpperCase();
    const dials30d = Number(stats?.dials_30d || 0);
    const lastHeartbeat = live?.last_heartbeat_at || null;

    // Only include if CCPRO active OR had dials in last 30 days
    if (!ccpro && dials30d === 0) continue;

    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || email.split('@')[0];
    const market = Array.isArray(c.market) ? c.market.join(', ') : String(c.market || '');
    const states = Array.isArray(c.states) ? c.states.join(', ') : String(c.states || '');

    rows.push({
      email,
      name,
      market,
      states,
      ccpro,
      aoiconnect,
      last_heartbeat: lastHeartbeat,
      dials_today: Number(stats?.dials_today || 0),
      dials_30d,
      reached_today: Number(stats?.reached_today || 0),
      booked_today: Number(stats?.booked_today || 0),
      last_login: lastHeartbeat,
    });
  }

  // Sort: CCPro active first, then by dials_30d desc
  rows.sort((a, b) => {
    if (a.ccpro && !b.ccpro) return -1;
    if (!a.ccpro && b.ccpro) return 1;
    return b.dials_30d - a.dials_30d;
  });

  return rows;
}

function buildCSV(rows: AgentRow[]): string {
  const headers = ['Name', 'Email', 'Market', 'States', 'CCPro Active', 'AOI Connect', 'Dials Today', 'Reached Today', 'Booked Today', 'Dials (30d)', 'Last Heartbeat'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      `"${r.name}"`,
      r.email,
      `"${r.market}"`,
      `"${r.states}"`,
      r.ccpro ? 'Yes' : 'No',
      r.aoiconnect,
      r.dials_today,
      r.reached_today,
      r.booked_today,
      r.dials_30d,
      r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : '',
    ].join(','));
  }
  return lines.join('\n');
}

function buildHTML(rows: AgentRow[], reportDate: string): string {
  const ccproCount = rows.filter(r => r.ccpro).length;
  const totalDials = rows.reduce((s, r) => s + r.dials_today, 0);
  const totalReached = rows.reduce((s, r) => s + r.reached_today, 0);
  const totalBooked = rows.reduce((s, r) => s + r.booked_today, 0);

  const tableRows = rows.map(r => `
    <tr style="background:${r.ccpro ? '#f0fff4' : '#fff'}">
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${r.market}</td>
      <td style="font-size:11px">${r.states}</td>
      <td style="text-align:center;color:${r.ccpro ? 'green' : '#999'};font-weight:bold">${r.ccpro ? '✓' : '—'}</td>
      <td style="text-align:center">${r.aoiconnect}</td>
      <td style="text-align:center">${r.dials_today}</td>
      <td style="text-align:center">${r.reached_today}</td>
      <td style="text-align:center">${r.booked_today}</td>
      <td style="text-align:center">${r.dials_30d}</td>
      <td style="font-size:11px;color:#666">${r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
  h2 { color: #1a1a2e; }
  .summary { background: #1a1a2e; color: white; padding: 12px 20px; border-radius: 6px; display: inline-flex; gap: 30px; margin-bottom: 20px; }
  .stat { text-align: center; }
  .stat .val { font-size: 22px; font-weight: bold; }
  .stat .lbl { font-size: 11px; opacity: 0.8; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { background: #1a1a2e; color: white; padding: 7px 10px; text-align: left; }
  td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  tr:hover td { background: #f9f9f9; }
</style></head>
<body>
<h2>AO Intel — Active Users Report</h2>
<p style="color:#666">${reportDate} &nbsp;|&nbsp; Pacific Time</p>
<div class="summary">
  <div class="stat"><div class="val">${rows.length}</div><div class="lbl">Total Users</div></div>
  <div class="stat"><div class="val">${ccproCount}</div><div class="lbl">CCPro Active</div></div>
  <div class="stat"><div class="val">${totalDials.toLocaleString()}</div><div class="lbl">Dials Today</div></div>
  <div class="stat"><div class="val">${totalReached.toLocaleString()}</div><div class="lbl">Reached Today</div></div>
  <div class="stat"><div class="val">${totalBooked}</div><div class="lbl">Booked Today</div></div>
</div>
<table>
  <thead><tr>
    <th>Name</th><th>Email</th><th>Market</th><th>States</th>
    <th>CCPro</th><th>AOI Connect</th><th>Dials Today</th><th>Reached</th><th>Booked</th><th>Dials 30d</th><th>Last Seen</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
</body></html>`;
}

export async function sendAOIntelActiveUsersReport(): Promise<void> {
  console.log('[AOIntel] Building active users report...');
  const rows = await buildReport();
  const reportDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const csv = buildCSV(rows);
  const html = buildHTML(rows, reportDate);

  const mg = new Mailgun(formData);
  const client = mg.client({ username: 'api', key: MAILGUN_API_KEY, url: 'https://api.mailgun.net' });

  await client.messages.create(MAILGUN_DOMAIN, {
    from: `AO Intel <noreply@${MAILGUN_DOMAIN}>`,
    to: REPORT_TO,
    subject: `AO Intel - Active Users — ${reportDate}`,
    html,
    attachment: [{ filename: `ao-intel-active-users-${new Date().toISOString().slice(0,10)}.csv`, data: Buffer.from(csv), contentType: 'text/csv' }],
  } as any);

  console.log(`[AOIntel] Report sent to ${REPORT_TO.join(', ')} — ${rows.length} agents, ${rows.filter(r=>r.ccpro).length} CCPro`);
}
