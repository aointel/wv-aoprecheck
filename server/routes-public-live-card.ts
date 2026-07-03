import type { Express, Request, Response } from 'express';
import {
  ensurePublicLiveCardTables,
  getOrCreatePermanentHierarchyLink,
  getManagerScope,
  getSnapshotByToken,
  rebuildAllLiveSnapshots,
  rebuildSnapshotForManager,
  seedChrisLiveLink,
  buildSnapshotForScope,
  normalizeDateRange,
} from './public-live-card-service';
import { buildActivityCardPayload } from './activity-card-report-service';
import { generateHTML } from './scripts/render-activity-card';
import { supabaseAdmin } from './supabase';

/** PST 5 AM–11:59 PM today; returns ISO strings for Supabase */
function getPstDayRangeIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const m = tz.match(/GMT([+-]\d{1,2})/);
  const h = Number(m?.[1] ?? -8);
  const sign = h >= 0 ? '+' : '-';
  const off = `${sign}${String(Math.abs(h)).padStart(2, '0')}:00`;
  const start = new Date(`${year}-${month}-${day}T05:00:00${off}`);
  const end = new Date(`${year}-${month}-${day}T23:59:59${off}`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Company-wide connects (and missedCalls) from billing_transactions only; avoids dependency on activity-card-report-service export. */
async function getCompanyConnectsFromBilling(): Promise<{ connects: number; missedCalls: number } | null> {
  try {
    const { startIso, endIso } = getPstDayRangeIso();
    const [connectsRes, missedRes] = await Promise.all([
      supabaseAdmin.from('billing_transactions').select('*', { count: 'exact', head: true }).eq('transaction_type', 'connect').gte('transaction_date', startIso).lt('transaction_date', endIso),
      supabaseAdmin.from('billing_transactions').select('*', { count: 'exact', head: true }).eq('transaction_type', 'missed_call').gte('created_at', startIso).lt('created_at', endIso),
    ]);
    return {
      connects: connectsRes.count ?? 0,
      missedCalls: missedRes.count ?? 0,
    };
  } catch {
    return null;
  }
}

function parseDateRange(req: Request): { startDate?: string; endDate?: string } {
  const startDate = String(req.query.startDate || '').trim() || undefined;
  const endDate = String(req.query.endDate || '').trim() || undefined;
  return { startDate, endDate };
}

function sseInit(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

export function registerPublicLiveCardRoutes(app: Express): void {
  app.get('/api/public/live-card/:identifier', async (req, res) => {
    try {
      await ensurePublicLiveCardTables();
      const range = parseDateRange(req);
      const snapshot = await getSnapshotByToken(String(req.params.identifier || ''), range);
      if (!snapshot) return res.status(404).json({ error: 'Link not found or disabled' });
      return res.json(snapshot);
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to load live card snapshot', details: error?.message || String(error) });
    }
  });

  app.get('/api/public/live-card/:identifier/stream', async (req, res) => {
    const token = String(req.params.identifier || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing identifier' });
    const range = parseDateRange(req);
    sseInit(res);

    let lastUpdatedAt = '';
    let closed = false;
    const push = async () => {
      const snapshot = await getSnapshotByToken(token, range);
      if (!snapshot) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Link not found or disabled' })}\n\n`);
        return;
      }
      if (snapshot.updatedAt !== lastUpdatedAt) {
        lastUpdatedAt = snapshot.updatedAt;
        res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      } else {
        res.write(`event: heartbeat\ndata: {"ok":true}\n\n`);
      }
    };

    const loop = setInterval(async () => {
      if (closed) return;
      try {
        await push();
      } catch (err: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err?.message || String(err) })}\n\n`);
      }
    }, 5000);

    try {
      await push();
    } catch {
      // no-op
    }

    req.on('close', () => {
      closed = true;
      clearInterval(loop);
      res.end();
    });
  });

  app.get('/api/public/live-card/:identifier/exact-html', async (req, res) => {
    try {
      const identifier = String(req.params.identifier || '').trim();
      if (!identifier) return res.status(400).send('Missing identifier');
      
      // Special handling for "aoi" identifier - hierarchy owners card
      if (identifier.toLowerCase() === 'aoi') {
        try {
          // Send first byte immediately so Varnish/CDN doesn't 503 (first byte timeout)
          res.status(200);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.write('<!-- loading -->\n');
          if (typeof (res as any).flush === 'function') (res as any).flush();

          console.log('🔥 AOI Card: Starting hierarchy owners fetch...');
          
          // AOI card: only MGA (not RGA) - get distinct MGA emails from agent_hierarchy
          const { data: hierarchyData, error: hierarchyError } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('mga_associate_id, mga_name')
            .not('mga_associate_id', 'is', null)
            .limit(1000);
          
          if (hierarchyError) {
            console.error('❌ AOI Card: Error fetching hierarchy data:', hierarchyError);
            throw hierarchyError;
          }
          
          console.log(`✅ AOI Card: Found ${hierarchyData?.length || 0} hierarchy rows (MGA only)`);
          
          const ownerMap = new Map<string, { email: string; name: string; type: 'mga' | 'rga' }>();
          
          if (hierarchyData && hierarchyData.length > 0) {
            const mgaAssociateIds = [...new Set((hierarchyData as any[]).map(r => Number(r.mga_associate_id)).filter(id => id > 0))];
            if (mgaAssociateIds.length > 0) {
              const { data: customers, error: customersError } = await supabaseAdmin
                .from('customers')
                .select('associate_id, company_email, first_name, last_name')
                .in('associate_id', mgaAssociateIds);
              
              if (!customersError && customers?.length) {
                const customerMap = new Map<number, any>();
                customers.forEach((c: any) => { if (c.associate_id) customerMap.set(Number(c.associate_id), c); });
                for (const row of hierarchyData as any[]) {
                  const mgaId = Number(row.mga_associate_id);
                  if (mgaId <= 0) continue;
                  const customer = customerMap.get(mgaId);
                  if (customer?.company_email) {
                    const email = String(customer.company_email).toLowerCase().trim();
                    if (!ownerMap.has(email)) {
                      ownerMap.set(email, {
                        email,
                        name: String(row.mga_name || `${customer.first_name || ''} ${customer.last_name || ''}`).trim() || 'Unknown',
                        type: 'mga'
                      });
                    }
                  }
                }
              }
            }
          }
          
          console.log(`✅ AOI Card: Found ${ownerMap.size} unique hierarchy owners`);
          
          // Top row: connects (and missedCalls) from billing_transactions data table only
          const companyConnects = await getCompanyConnectsFromBilling();
          if (companyConnects) console.log(`✅ AOI Card: Company-wide connects from billing table: ${companyConnects.connects}`);
          
          const owners = Array.from(ownerMap.values());
          const batchSize = 10;
          const ownerPayloads: PromiseSettledResult<{ owner: any; liveAgents: any[]; totalAgents: number }>[] = [];
          
          for (let i = 0; i < owners.length; i += batchSize) {
            const batch = owners.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
              batch.map(async (owner) => {
                const scope = await getManagerScope(owner.email);
                const dateRange = normalizeDateRange();
                const freshSnapshot = await buildSnapshotForScope(scope, dateRange);
                return {
                  owner,
                  liveAgents: freshSnapshot.fullRank || [],
                  totalAgents: scope.agentEmails?.length ?? 0,
                };
              })
            );
            ownerPayloads.push(...batchResults);
          }
          
          // Convert hierarchy owners to "agent" format with their agency totals
          const ownerAgents: any[] = [];
          const allTotals = {
            activeAgents: 0,
            totalAgents: 0,
            dials: 0,
            reach: 0,
            booked: 0,
            instant: 0,
            connects: 0,
            missedCalls: 0,
            aoiUsage: 0,
          };
          
          // Track unique agents across all owners to prevent double counting
          const uniqueAgentsMap = new Map<string, {
            email: string;
            dials: number;
            reach: number;
            booked: number;
            instant: number;
            connects: number;
            missedCalls: number;
            aoiUsage: number;
          }>();
          
          let successCount = 0;
          let failedCount = 0;
          const failedOwners: string[] = [];
          
          for (const result of ownerPayloads) {
            if (result.status === 'fulfilled') {
              try {
                const { owner, liveAgents } = result.value;
                
                // Get owner photo
                const { data: profile } = await supabaseAdmin
                  .from('agent_profiles')
                  .select('profile_picture')
                  .eq('email', owner.email)
                  .maybeSingle();
                
                // Calculate totals from live agents (which respect date range)
                const ownerDials = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.dials || 0), 0);
                const ownerReach = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.reach || 0), 0);
                const ownerBooked = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.booked || 0), 0);
                const ownerInstant = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.instant || 0), 0);
                const ownerConnects = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.connects || 0), 0);
                const ownerMissedCalls = (liveAgents || []).reduce((s: number, a: any) => s + Number(a?.missedCalls || 0), 0);
                const ownerAoiUsage = Math.round((liveAgents || []).reduce((s: number, a: any) => s + Number(a?.aoiUsage || 0), 0) / Math.max(1, (liveAgents || []).length));
                
                // Create owner as "agent" with their agency totals (using date-filtered data)
                ownerAgents.push({
                  name: owner.name,
                  email: owner.email,
                  dials: ownerDials,
                  reach: ownerReach,
                  booked: ownerBooked,
                  instant: ownerInstant,
                  connects: ownerConnects,
                  missedCalls: ownerMissedCalls,
                  aoiUsage: ownerAoiUsage,
                  rank: 0, // Will be calculated by sorting
                  rankChange: 0,
                  photoUrl: profile?.profile_picture || null,
                  agents: liveAgents || [], // Store their agents for accordion (date-filtered)
                });
                
                // Track unique agents to prevent double counting in totals
                // (An agent might appear under multiple owners, so we only count them once)
                for (const agent of liveAgents || []) {
                  const agentEmail = String(agent?.email || '').toLowerCase().trim();
                  if (!agentEmail) continue;
                  
                  if (!uniqueAgentsMap.has(agentEmail)) {
                    uniqueAgentsMap.set(agentEmail, {
                      email: agentEmail,
                      dials: Number(agent?.dials || 0),
                      reach: Number(agent?.reach || 0),
                      booked: Number(agent?.booked || 0),
                      instant: Number(agent?.instant || 0),
                      connects: Number(agent?.connects || 0),
                      missedCalls: Number(agent?.missedCalls || 0),
                      aoiUsage: Number(agent?.aoiUsage || 0),
                    });
                  }
                }
                
                successCount++;
              } catch (err: any) {
                failedCount++;
                const ownerEmail = result.value?.owner?.email || 'unknown';
                failedOwners.push(ownerEmail);
                console.error(`❌ AOI Card: Error processing owner data for ${ownerEmail}:`, err.message);
              }
            } else {
              failedCount++;
              const ownerEmail = (result as any).value?.owner?.email || 'unknown';
              failedOwners.push(ownerEmail);
              console.error(`❌ AOI Card: Failed to process owner ${ownerEmail}:`, result.reason?.message || result.reason);
            }
          }
          
          // Calculate totals from unique agents only (no double counting)
          for (const agent of uniqueAgentsMap.values()) {
            allTotals.activeAgents += 1;
            allTotals.dials += agent.dials;
            allTotals.reach += agent.reach;
            allTotals.booked += agent.booked;
            allTotals.instant += agent.instant;
            allTotals.connects += agent.connects;
            allTotals.missedCalls += agent.missedCalls;
            allTotals.aoiUsage += agent.aoiUsage;
          }
          
          // totalAgents = unique agents (no double-count when agent reports to multiple MGAs)
          allTotals.totalAgents = uniqueAgentsMap.size;
          
          // Top row: use company-wide connects/missedCalls from billing_transactions (single source of truth)
          if (companyConnects) {
            allTotals.connects = companyConnects.connects;
            allTotals.missedCalls = companyConnects.missedCalls;
          }
          
          if (failedCount > 0) {
            console.warn(`⚠️ AOI Card: ${failedCount} owners failed to process: ${failedOwners.join(', ')}`);
          }
          
          // Sort owners by performance score (same as agents)
          const score = (a: any) => (a.dials * 1) + (a.reach * 10) + (a.booked * 40) + (a.connects * 25) + (a.instant * 80);
          ownerAgents.sort((a, b) => {
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            if (b.booked !== a.booked) return b.booked - a.booked;
            if (b.reach !== a.reach) return b.reach - a.reach;
            return b.dials - a.dials;
          });
          
          // Assign ranks
          ownerAgents.forEach((agent, idx) => {
            agent.rank = idx + 1;
          });
          
          console.log(`✅ AOI Card: Successfully processed ${successCount}/${owners.length} owners (${owners.length - successCount} failed)`);
          
          // Create combined payload - show owners as agents
          const combinedPayload = {
            generatedAt: new Date().toISOString(),
            agencyName: 'AO INTELLIGENCE',
            totals: {
              ...allTotals,
              dialsPct: 0,
              dialsTrend: 'up' as const,
              reachPct: 0,
              reachTrend: 'up' as const,
              bookedPct: 0,
              bookedTrend: 'up' as const,
              instantPct: 0,
              instantTrend: 'up' as const,
              connectsPct: 0,
              connectsTrend: 'up' as const,
              missedCallsPct: 0,
              missedCallsTrend: 'up' as const,
              aoiUsagePct: 0,
              aoiUsageTrend: 'up' as const,
              deltaPct: 0,
              weeklyProductionEst: Math.round(allTotals.booked * 100 + allTotals.instant * 200 + allTotals.connects * 250),
              previousWeeksALP: 89000,
            },
            chart: { labels: [], series: [] },
            agents: ownerAgents,
          };
        
          let html = generateHTML(combinedPayload as any);
          html = html
            .replace(
              '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">'
            )
            .replace(
              '</head>',
              `<style>
                /* Responsive layout - CSS handles everything */
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 100% !important;
                  overflow-x: hidden !important;
                  overflow-y: auto !important;
                  background: #081424 !important;
                  -webkit-text-size-adjust: 100% !important;
                }
                body {
                  display: flex !important;
                  align-items: flex-start !important;
                  justify-content: center !important;
                }
                #card-root {
                  margin: 0 auto !important;
                  width: 100% !important;
                  max-width: 1290px !important;
                }
                /* Only the producer list scrolls */
                #leaderboard-all-rows { 
                  max-height: 60vh !important; 
                  overflow-y: auto !important; 
                  overflow-x: hidden !important; 
                  -webkit-overflow-scrolling: touch !important;
                  touch-action: pan-y !important;
                }
              </style></head>`
            )
            .replace(
              '</body>',
            `<script>
              (function(){
                var identifier = ${JSON.stringify(identifier)};
                var realtimeEndpoint = '/api/public/live-card/' + encodeURIComponent(identifier) + '/realtime-data';
                var streamEndpoint = '/api/public/live-card/' + encodeURIComponent(identifier) + '/stream';
                var isPhoneClient = /iPhone|Android.+Mobile|Mobile/i.test(navigator.userAgent || '') || (window.innerWidth || 0) <= 430;
                var liveEs = null;
                var pollTimer = null;
                var reconnectTimer = null;

                function fitCard(){
                  // No-op: CSS handles responsive layout
                }

                function asCurrency(value){
                  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
                }

                function formatAoiUsage(value){
                  var totalMinutes = Math.max(0, Math.round(Number(value) || 0));
                  var hours = Math.floor(totalMinutes / 60);
                  var minutes = totalMinutes % 60;
                  if (hours > 0 && minutes === 0) return hours + 'H';
                  if (hours > 0) return hours + 'H ' + minutes + 'M';
                  return totalMinutes + 'M';
                }

                function rankChangeHTML(changeValue){
                  var value = Number(changeValue || 0);
                  if (value > 0) return '<div class="rank-change up">+' + value + ' ▲</div>';
                  if (value < 0) return '<div class="rank-change down">' + value + ' ▼</div>';
                  return '<div class="rank-change flat">0</div>';
                }

                function formatAgentName(name){
                  var cleaned = String(name || '').replace(/\\s+/g, ' ').trim();
                  if (!cleaned) return '<div class="agent-first">Unknown</div>';
                  var parts = cleaned.split(' ');
                  var first = parts[0] || '';
                  var last = parts.length > 1 ? parts[parts.length - 1] : '';
                  if (!last || first.toLowerCase() === last.toLowerCase()) return '<div class="agent-first">' + first + '</div>';
                  return '<div class="agent-first">' + first + '</div><div class="agent-last">' + last + '</div>';
                }
                
                var agencyPerfState = {
                  hash: '',
                  rawHash: '',
                  sorted: [],
                  isTouching: false,
                  touchLockUntil: 0,
                  expandedOwners: new Set() // Track which owner emails are expanded
                };
                var chartState = { debounceTimer: null };
                var pendingUpdate = null;
                var globalTouchLockUntil = 0;

                function hashAgentsLightweight(agents){
                  return agents.map(function(a){ return (a.name || '') + '|' + (a.dials || 0) + '|' + (a.reach || 0) + '|' + (a.booked || 0); }).join('||');
                }

                function agencyScore(a){
                  return (a.dials || 0) * 1 + (a.reach || 0) * 10 + (a.booked || 0) * 40 + (a.connects || 0) * 25 + (a.instant || 0) * 80;
                }

                function normalizeAgent(a, idx){
                  if (!a || !a.name) return null;
                  return {
                    name: String(a.name || '').trim(),
                    dials: Number(a.dials || 0),
                    reach: Number(a.reach || 0),
                    booked: Number(a.booked || 0),
                    instant: Number(a.instant || 0),
                    connects: Number(a.connects || 0),
                    missedCalls: Number(a.missedCalls || 0),
                    aoiUsage: Number(a.aoiUsage || 0),
                    rank: idx + 1,
                    rankChange: Number(a.rankChange || 0),
                    photoUrl: a.photoUrl || null,
                    agents: a.agents || null, // Preserve agents array for accordion
                    email: a.email || null // Preserve email for owner identification
                  };
                }

                function agentRowNode(agent, idx){
                  var row = document.createElement('div');
                  var isOwner = agent.agents && Array.isArray(agent.agents) && agent.agents.length > 0;
                  row.className = 'leaderboard-row' + (isOwner ? ' owner-row' : '');
                  if (isOwner) {
                    row.setAttribute('data-owner-email', agent.email || '');
                    row.setAttribute('data-expanded', 'false');
                    // Store agents data as JSON on the row element so we can access it in click handler
                    row.setAttribute('data-agents', JSON.stringify(agent.agents || []));
                    row.style.cursor = 'pointer';
                    row.style.position = 'relative';
                  }
                  var rankClass = agent.rank === 1 ? 'rank-1' : '';
                  var initials = agent.name.split(' ').map(function(n){ return n[0]; }).join('').substring(0, 2).toUpperCase();
                  var rowProgress = Math.max(12, Math.min(100, Math.round(agent.aoiUsage)));
                  var demoPhotoUrl = agent.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(agent.name) + '&size=256&background=0f172a&color=e2e8f0&bold=true';
                  
                  var chevronIcon = isOwner ? '<div class="chevron-icon" style="position:absolute;left:8px;top:50%;transform:translateY(-50%) rotate(0deg);width:12px;height:12px;color:#94A3B8;transition:transform 0.2s;z-index:10;pointer-events:none;">▶</div>' : '';
                  
                  row.innerHTML = chevronIcon +
                    '<div class="rank ' + rankClass + '">' + agent.rank + '</div>' +
                    '<div class="avatar"><img src="' + demoPhotoUrl + '" alt="' + agent.name + '" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'flex\\';"><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#FFFFFF;">' + initials + '</div></div>' +
                    '<div class="agent-name-section">' + formatAgentName(agent.name) + '</div>' +
                    rankChangeHTML(agent.rankChange) +
                    '<div class="stat-value"><div class="stat-main">' + Number(agent.dials || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main">' + Number(agent.reach || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main">' + Number(agent.booked || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main">' + Number(agent.instant || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main">' + Number(agent.connects || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main missed">' + Number(agent.missedCalls || 0) + '</div></div>' +
                    '<div class="stat-value"><div class="stat-main usage">' + formatAoiUsage(agent.aoiUsage) + '</div></div>' +
                    '<div class="row-progress"><div class="row-progress-fill" style="width:' + rowProgress + '%"></div></div>';
                  
                  // Add click handler for owner rows
                  if (isOwner) {
                    var ownerEmail = agent.email || '';
                    // Check if this owner was previously expanded
                    var wasExpanded = agencyPerfState.expandedOwners.has(ownerEmail);
                    if (wasExpanded) {
                      row.setAttribute('data-expanded', 'true');
                      row.classList.add('expanded');
                    }
                    
                    row.addEventListener('click', function(e){
                      e.stopPropagation();
                      e.preventDefault();
                      var expanded = row.getAttribute('data-expanded') === 'true';
                      var nestedContainer = row.nextElementSibling;
                      
                      if (expanded) {
                        // Collapse
                        row.setAttribute('data-expanded', 'false');
                        row.classList.remove('expanded');
                        agencyPerfState.expandedOwners.delete(ownerEmail);
                        if (nestedContainer && nestedContainer.classList.contains('nested-agents-container')) {
                          nestedContainer.style.display = 'none';
                        }
                        var chevron = row.querySelector('.chevron-icon');
                        if (chevron) chevron.style.transform = 'translateY(-50%) rotate(0deg)';
                      } else {
                        // Expand
                        row.setAttribute('data-expanded', 'true');
                        row.classList.add('expanded');
                        agencyPerfState.expandedOwners.add(ownerEmail);
                        
                        // Get agents from data attribute
                        var agentsJson = row.getAttribute('data-agents') || '[]';
                        var nestedAgents = [];
                        try {
                          nestedAgents = JSON.parse(agentsJson);
                        } catch (e) {
                          console.error('Failed to parse agents data:', e);
                          nestedAgents = [];
                        }
                        
                        // Create or show nested container
                        if (!nestedContainer || !nestedContainer.classList.contains('nested-agents-container')) {
                          nestedContainer = document.createElement('div');
                          nestedContainer.className = 'nested-agents-container';
                          nestedContainer.style.display = 'block';
                          nestedContainer.style.marginLeft = '20px';
                          nestedContainer.style.borderLeft = '2px solid rgba(148, 163, 184, 0.3)';
                          nestedContainer.style.paddingLeft = '10px';
                          nestedContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
                          row.parentNode.insertBefore(nestedContainer, row.nextSibling);
                        } else {
                          nestedContainer.style.display = 'block';
                        }
                        
                        // Render nested agents
                        nestedContainer.innerHTML = '';
                        for (var i = 0; i < nestedAgents.length; i++) {
                          var nestedAgent = nestedAgents[i];
                          var nestedRow = agentRowNode(nestedAgent, i);
                          nestedRow.style.opacity = '0.9';
                          nestedRow.style.fontSize = '0.9em';
                          nestedContainer.appendChild(nestedRow);
                        }
                        
                        var chevron = row.querySelector('.chevron-icon');
                        if (chevron) chevron.style.transform = 'translateY(-50%) rotate(90deg)';
                      }
                    });
                    
                    // If was expanded, expand it now
                    if (wasExpanded) {
                      var clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                      row.dispatchEvent(clickEvent);
                    }
                  }
                  
                  return row;
                }

                function appendAgencyRows(rowsHost, fromIndex, toIndex){
                  var fragment = document.createDocumentFragment();
                  for (var i = fromIndex; i < toIndex; i++) {
                    var agent = agencyPerfState.sorted[i];
                    if (!agent) break;
                    fragment.appendChild(agentRowNode(agent, i));
                  }
                  rowsHost.appendChild(fragment);
                }

                function renderAgencyPerformance(agents){
                  var rowsHost = document.getElementById('leaderboard-all-rows');
                  if (!rowsHost) return;
                  try {
                    var prevScrollTop = rowsHost.scrollTop || 0;
                    var safeAgents = (Array.isArray(agents) ? agents : [])
                      .map(function(a, idx){ return normalizeAgent(a, idx); })
                      .filter(function(a){ return !!a; });
                    var rawHash = hashAgentsLightweight(safeAgents);
                    if (agencyPerfState.rawHash === rawHash) return;
                    agencyPerfState.rawHash = rawHash;
                    var sorted = safeAgents.slice().sort(function(a, b){
                      var diff = agencyScore(b) - agencyScore(a);
                      if (diff !== 0) return diff;
                      if (b.booked !== a.booked) return b.booked - a.booked;
                      if (b.reach !== a.reach) return b.reach - a.reach;
                      return b.dials - a.dials;
                    });
                    var signature = hashAgentsLightweight(sorted);

                    if (agencyPerfState.hash !== signature) {
                      agencyPerfState.hash = signature;
                      agencyPerfState.sorted = sorted;
                      
                      // Render all agents - simple approach
                      var fragment = document.createDocumentFragment();
                      for (var i = 0; i < sorted.length; i++) {
                        var agent = sorted[i];
                        if (!agent) break;
                        fragment.appendChild(agentRowNode(agent, i));
                      }
                      while (rowsHost.firstChild) rowsHost.removeChild(rowsHost.firstChild);
                      rowsHost.appendChild(fragment);
                      rowsHost.scrollTop = prevScrollTop;
                    }
                  } catch (err) {
                    console.error('Live agency performance render error:', err);
                  }
                }

                function drawChart(chart){
                  // Chart rendering code would go here
                }

                function applyLiveData(data){
                  if (!data || !data.totals) return;
                  
                  // Queue updates during touch, apply after touch ends
                  var now = Date.now();
                  if (agencyPerfState.isTouching || now < agencyPerfState.touchLockUntil || now < globalTouchLockUntil) {
                    pendingUpdate = data;
                    return;
                  }
                  
                  // Apply pending update if it exists
                  if (pendingUpdate) {
                    data = pendingUpdate;
                    pendingUpdate = null;
                  }
                  
                  var date = new Date(data.generatedAt || Date.now());
                  var timeEl = document.getElementById('time-display');
                  if (timeEl) {
                    timeEl.textContent = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                  }
                  var totals = data.totals || {};
                  var totalAgents = Number(totals.totalAgents || 0);
                  var d = document.getElementById('kpi-agents'); if (d) d.textContent = String(Number(totals.activeAgents || 0)) + '/' + String(totalAgents);
                  d = document.getElementById('kpi-dials-number'); if (d) d.textContent = Number(totals.dials || 0).toLocaleString();
                  d = document.getElementById('kpi-reach-number'); if (d) d.textContent = Number(totals.reach || 0).toLocaleString();
                  d = document.getElementById('kpi-booked-number'); if (d) d.textContent = Number(totals.booked || 0).toLocaleString();
                  d = document.getElementById('kpi-instant-number'); if (d) d.textContent = Number(totals.instant || 0).toLocaleString();
                  d = document.getElementById('kpi-connects-number'); if (d) d.textContent = Number(totals.connects || 0).toLocaleString();
                  d = document.getElementById('kpi-missed-number'); if (d) d.textContent = Number(totals.missedCalls || 0).toLocaleString();

                  var deltaPct = Number(totals.deltaPct || 0);
                  var deltaEl = document.getElementById('delta-value');
                  if (deltaEl) {
                    var isUp = deltaPct >= 0;
                    deltaEl.textContent = (isUp ? '+' : '-') + Math.round(Math.abs(deltaPct)) + '%';
                    deltaEl.style.color = isUp ? '#10B981' : '#EF4444';
                  }

                  var weeklyProductionEst = Number(totals.weeklyProductionEst || Math.round(Number(totals.booked || 0) * 220));
                  var previousWeeksALP = Number(totals.previousWeeksALP || 89000);
                  var weeklyProgress = Math.min(100, Math.max(8, Math.round((weeklyProductionEst / Math.max(previousWeeksALP, 1)) * 100)));
                  var weeklyChange = weeklyProductionEst - previousWeeksALP;
                  var weeklyChangePct = previousWeeksALP > 0 ? (weeklyChange / previousWeeksALP) * 100 : 0;
                  var weeklyUp = weeklyChange >= 0;
                  var goalPercentEl = document.getElementById('goal-percent');
                  var goalFillEl = document.getElementById('goal-bar-fill');
                  var goalTargetEl = document.getElementById('goal-target');
                  var goalChangeEl = document.getElementById('goal-change');
                  if (goalPercentEl) goalPercentEl.textContent = asCurrency(weeklyProductionEst);
                  if (goalFillEl) goalFillEl.style.width = weeklyProgress + '%';
                  if (goalTargetEl) goalTargetEl.textContent = 'Previous Weeks ALP: ' + asCurrency(previousWeeksALP);
                  if (goalChangeEl) {
                    goalChangeEl.textContent = 'Change: ' + (weeklyUp ? '+' : '-') + asCurrency(Math.abs(weeklyChange)) + ' (' + (weeklyUp ? '+' : '-') + Math.abs(weeklyChangePct).toFixed(1) + '%) ' + (weeklyUp ? '▲' : '▼');
                    goalChangeEl.className = 'goal-change ' + (weeklyUp ? 'up' : 'down');
                  }

                  renderAgencyPerformance(data.agents || []);
                  
                  // Debounce chart redraws (max once per 500ms) - clear timer if touching
                  var chartData = data.chart || { labels: [], series: [] };
                  var now = Date.now();
                  if (agencyPerfState.isTouching || now < agencyPerfState.touchLockUntil || now < globalTouchLockUntil) {
                    // Clear debounce timer if touch starts - don't queue chart redraw during touch
                  if (chartState.debounceTimer) clearTimeout(chartState.debounceTimer);
                  chartState.debounceTimer = setTimeout(function(){
                    drawChart(chartData);
                    chartState.debounceTimer = null;
                  }, 300);
                  }
                }

                function normalizeLayoutForLive(){
                  var titles = document.querySelectorAll('.leaderboard-section-title');
                  if (titles && titles[0]) titles[0].textContent = 'AGENCY PERFORMANCE';
                  var sections = document.querySelectorAll('.leaderboard-section');
                  if (sections && sections[1]) sections[1].style.display = 'none';
                }

                async function fetchAndApply(){
                  if ((window).__liveFetchInFlight) return;
                  (window).__liveFetchInFlight = true;
                  try {
                    var response = await fetch(realtimeEndpoint, { credentials: 'include' });
                    if (!response.ok) return;
                    var payload = await response.json();
                    applyLiveData(payload);
                  } catch (_err) {
                  } finally {
                    (window).__liveFetchInFlight = false;
                  }
                }

                function wireLiveStream(){
                  if (isPhoneClient) {
                    // Mobile safe mode: polling is more stable than SSE on iOS Safari/WebView.
                    if (!pollTimer) {
                      pollTimer = setInterval(fetchAndApply, 15000);
                    }
                    return;
                  }

                  var connect = function(){
                    try {
                      if (liveEs) {
                        try { liveEs.close(); } catch (_e) {}
                        liveEs = null;
                      }
                      liveEs = new EventSource(streamEndpoint);
                      liveEs.addEventListener('snapshot', function(){ fetchAndApply(); });
                      liveEs.onerror = function(){
                        fetchAndApply();
                        if (reconnectTimer) return;
                        reconnectTimer = setTimeout(function(){
                          reconnectTimer = null;
                          connect();
                        }, 3000);
                      };
                    } catch (_err) {
                      if (!pollTimer) {
                        pollTimer = setInterval(fetchAndApply, 15000);
                      }
                    }
                  };

                  connect();
                }

                fitCard();
                normalizeLayoutForLive();
                fetchAndApply();
                wireLiveStream();
                window.addEventListener('resize', fitCard);

                // Prevent pinch/double-tap zoom on iOS
                document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, { passive: false });
                document.addEventListener('gesturechange', function(e){ e.preventDefault(); }, { passive: false });
                document.addEventListener('gestureend', function(e){ e.preventDefault(); }, { passive: false });

                // Prevent double-tap zoom
                var lastTouchEnd = 0;
                document.addEventListener('touchend', function(e){
                  var now = Date.now();
                  if (now - lastTouchEnd <= 300) e.preventDefault();
                  lastTouchEnd = now;
                }, { passive: false });
              })();
            </script></body>`
          );
          res.write(html);
          return res.end();
        } catch (aoiError: any) {
          console.error('❌ AOI Card: Error generating card:', aoiError);
          const errHtml = `<html><body style="background:#081424;color:#fff;padding:40px;font-family:sans-serif;"><h1>Error Loading AOI Card</h1><p>${String(aoiError?.message || aoiError || 'Unknown error')}</p></body></html>`;
          if (res.headersSent) {
            res.write(errHtml);
            return res.end();
          }
          return res.status(500).send(errHtml);
        }
      }
      
      const snapshot = await getSnapshotByToken(identifier);
      if (!snapshot) return res.status(404).send('Link not found');

      const scope = await getManagerScope(snapshot.managerEmail);
      const payload = await buildActivityCardPayload({
        scopeKey: scope.scopeKey,
        managerName: scope.managerName,
        managerEmail: scope.managerEmail,
        agentEmails: scope.agentEmails,
        hierarchyNameByEmail: scope.hierarchyNameByEmail,
      });

      let html = generateHTML(payload as any);
      html = html
        .replace(
          '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
          '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">'
        )
        .replace(
          '</head>',
          `<style>
            /* Responsive layout - CSS handles everything */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              overflow-x: hidden !important;
              overflow-y: auto !important;
              background: #081424 !important;
              -webkit-text-size-adjust: 100% !important;
            }
            body {
              display: flex !important;
              align-items: flex-start !important;
              justify-content: center !important;
            }
            #card-root {
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 1290px !important;
            }
            /* Only the producer list scrolls */
            #leaderboard-all-rows { 
              max-height: 60vh !important; 
              overflow-y: auto !important; 
              overflow-x: hidden !important; 
              -webkit-overflow-scrolling: touch !important;
              touch-action: pan-y !important;
            }
          </style></head>`
        )
        .replace(
          '</body>',
          `<script>
            (function(){
              var identifier = ${JSON.stringify(identifier)};
              var realtimeEndpoint = '/api/public/live-card/' + encodeURIComponent(identifier) + '/realtime-data';
              var streamEndpoint = '/api/public/live-card/' + encodeURIComponent(identifier) + '/stream';
              var isPhoneClient = /iPhone|Android.+Mobile|Mobile/i.test(navigator.userAgent || '') || (window.innerWidth || 0) <= 430;
              var liveEs = null;
              var pollTimer = null;
              var reconnectTimer = null;

              function fitCard(){
                // No-op: CSS handles responsive layout
              }

              function asCurrency(value){
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
              }

              function formatAoiUsage(value){
                var totalMinutes = Math.max(0, Math.round(Number(value) || 0));
                var hours = Math.floor(totalMinutes / 60);
                var minutes = totalMinutes % 60;
                if (hours > 0 && minutes === 0) return hours + 'H';
                if (hours > 0) return hours + 'H ' + minutes + 'M';
                return totalMinutes + 'M';
              }

              function rankChangeHTML(changeValue){
                var value = Number(changeValue || 0);
                if (value > 0) return '<div class="rank-change up">+' + value + ' ▲</div>';
                if (value < 0) return '<div class="rank-change down">' + value + ' ▼</div>';
                return '<div class="rank-change flat">0</div>';
              }

              function formatAgentName(name){
                var cleaned = String(name || '').replace(/\\s+/g, ' ').trim();
                if (!cleaned) return '<div class="agent-first">Unknown</div>';
                var parts = cleaned.split(' ');
                var first = parts[0] || '';
                var last = parts.length > 1 ? parts[parts.length - 1] : '';
                if (!last || first.toLowerCase() === last.toLowerCase()) return '<div class="agent-first">' + first + '</div>';
                return '<div class="agent-first">' + first + '</div><div class="agent-last">' + last + '</div>';
              }

              var agencyPerfState = {
                hash: '',
                rawHash: '',
                sorted: [],
                renderedCount: 0,
                chunkSize: 12,
                wired: false,
                expandedOwners: new Set() // Track which owner emails are expanded
              };
              
              var chartState = {
                debounceTimer: null,
                lastChartData: null
              };
              
              // Queue for updates that arrive during touch
              var pendingUpdate = null;

              function agencyScore(a){
                return (Number(a.dials||0) * 1) + (Number(a.reach||0) * 10) + (Number(a.booked||0) * 40) + (Number(a.connects||0) * 25) + (Number(a.instant||0) * 80);
              }

              function normalizeAgent(agent, idx){
                if (!agent || typeof agent !== 'object') return null;
                var safe = Object.assign({}, agent);
                safe.rank = Number(safe.rank || (idx + 1));
                safe.rankChange = Number(safe.rankChange || 0);
                safe.name = String(safe.name || safe.email || 'Unknown');
                safe.email = String(safe.email || '').toLowerCase().trim();
                safe.dials = Number(safe.dials || 0);
                safe.reach = Number(safe.reach || 0);
                safe.booked = Number(safe.booked || 0);
                safe.instant = Number(safe.instant || 0);
                safe.connects = Number(safe.connects || 0);
                safe.missedCalls = Number(safe.missedCalls || 0);
                safe.aoiUsage = Number(safe.aoiUsage || 0);
                safe.photoUrl = String(safe.photoUrl || '').trim();
                // Preserve agents array for accordion
                if (agent.agents && Array.isArray(agent.agents)) {
                  safe.agents = agent.agents;
                }
                return safe;
              }

              function hashAgentsLightweight(agents){
                var h = 2166136261;
                for (var i = 0; i < agents.length; i++) {
                  var a = agents[i] || {};
                  var key = String(a.email || a.name || '') + '|' +
                    String(a.rank || '') + '|' +
                    String(a.dials || 0) + '|' +
                    String(a.reach || 0) + '|' +
                    String(a.booked || 0) + '|' +
                    String(a.instant || 0) + '|' +
                    String(a.connects || 0) + '|' +
                    String(a.missedCalls || 0) + '|' +
                    String(a.aoiUsage || 0);
                  for (var j = 0; j < key.length; j++) {
                    h ^= key.charCodeAt(j);
                    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
                  }
                }
                return (h >>> 0).toString(16) + ':' + agents.length;
              }

              function agentRowNode(agent, idx){
                var row = document.createElement('div');
                var isOwner = agent.agents && Array.isArray(agent.agents) && agent.agents.length > 0;
                row.className = 'leaderboard-row' + (isOwner ? ' owner-row' : '');
                if (isOwner) {
                  row.setAttribute('data-owner-email', agent.email || '');
                  row.setAttribute('data-expanded', 'false');
                  // Store agents data as JSON on the row element so we can access it in click handler
                  row.setAttribute('data-agents', JSON.stringify(agent.agents || []));
                  row.style.cursor = 'pointer';
                  row.style.position = 'relative';
                }
                var rank = Number(agent.rank || (idx + 1));
                var rankClass = rank === 1 ? 'rank-1' : '';
                var name = String(agent.name || 'Unknown');
                var initials = name.split(' ').map(function(n){ return n[0] || ''; }).join('').substring(0,2).toUpperCase();
                var photoUrl = agent.photoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&size=256&background=0f172a&color=e2e8f0&bold=true');
                var rowProgress = Math.max(12, Math.min(100, Math.round(Number(agent.aoiUsage || 0))));
                
                var chevronIcon = isOwner ? '<div class="chevron-icon" style="position:absolute;left:8px;top:50%;transform:translateY(-50%) rotate(0deg);width:12px;height:12px;color:#94A3B8;transition:transform 0.2s;z-index:10;pointer-events:none;">▶</div>' : '';
                
                row.innerHTML = chevronIcon +
                  '<div class="rank ' + rankClass + '">#' + rank + '</div>' +
                  '<div class="avatar"><img src="' + photoUrl + '" alt="' + name + '" onerror="(function(img){var p=img.parentElement;if(p){p.innerHTML=\\'' + initials + '\\';p.style.background=\\'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)\\';}})(this)" /></div>' +
                  '<div class="agent-name-section">' + formatAgentName(name) + '</div>' +
                  rankChangeHTML(agent.rankChange) +
                  '<div class="stat-value"><div class="stat-main">' + Number(agent.dials || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main">' + Number(agent.reach || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main">' + Number(agent.booked || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main">' + Number(agent.instant || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main">' + Number(agent.connects || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main missed">' + Number(agent.missedCalls || 0) + '</div></div>' +
                  '<div class="stat-value"><div class="stat-main usage">' + formatAoiUsage(agent.aoiUsage) + '</div></div>' +
                  '<div class="row-progress"><div class="row-progress-fill" style="width:' + rowProgress + '%"></div></div>';
                
                // Add click handler for owner rows
                if (isOwner) {
                  var ownerEmail = agent.email || '';
                  // Check if this owner was previously expanded
                  var wasExpanded = agencyPerfState.expandedOwners.has(ownerEmail);
                  if (wasExpanded) {
                    row.setAttribute('data-expanded', 'true');
                    row.classList.add('expanded');
                  }
                  
                  row.addEventListener('click', function(e){
                    e.stopPropagation();
                    e.preventDefault();
                    var expanded = row.getAttribute('data-expanded') === 'true';
                    var nestedContainer = row.nextElementSibling;
                    
                    if (expanded) {
                      // Collapse
                      row.setAttribute('data-expanded', 'false');
                      row.classList.remove('expanded');
                      agencyPerfState.expandedOwners.delete(ownerEmail);
                      if (nestedContainer && nestedContainer.classList.contains('nested-agents-container')) {
                        nestedContainer.style.display = 'none';
                      }
                      var chevron = row.querySelector('.chevron-icon');
                      if (chevron) chevron.style.transform = 'translateY(-50%) rotate(0deg)';
                    } else {
                      // Expand
                      row.setAttribute('data-expanded', 'true');
                      row.classList.add('expanded');
                      agencyPerfState.expandedOwners.add(ownerEmail);
                      
                      // Get agents from data attribute
                      var agentsJson = row.getAttribute('data-agents') || '[]';
                      var nestedAgents = [];
                      try {
                        nestedAgents = JSON.parse(agentsJson);
                      } catch (e) {
                        console.error('Failed to parse agents data:', e);
                        nestedAgents = [];
                      }
                      
                      // Create or show nested container
                      if (!nestedContainer || !nestedContainer.classList.contains('nested-agents-container')) {
                        nestedContainer = document.createElement('div');
                        nestedContainer.className = 'nested-agents-container';
                        nestedContainer.style.display = 'block';
                        nestedContainer.style.marginLeft = '20px';
                        nestedContainer.style.borderLeft = '2px solid rgba(148, 163, 184, 0.3)';
                        nestedContainer.style.paddingLeft = '10px';
                        nestedContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
                        row.parentNode.insertBefore(nestedContainer, row.nextSibling);
                      } else {
                        nestedContainer.style.display = 'block';
                      }
                      
                      // Render nested agents
                      nestedContainer.innerHTML = '';
                      for (var i = 0; i < nestedAgents.length; i++) {
                        var nestedAgent = nestedAgents[i];
                        var nestedRow = agentRowNode(nestedAgent, i);
                        nestedRow.style.opacity = '0.9';
                        nestedRow.style.fontSize = '0.9em';
                        nestedContainer.appendChild(nestedRow);
                      }
                      
                      var chevron = row.querySelector('.chevron-icon');
                      if (chevron) chevron.style.transform = 'translateY(-50%) rotate(90deg)';
                    }
                  });
                  
                  // If was expanded, expand it now
                  if (wasExpanded) {
                    var clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                    row.dispatchEvent(clickEvent);
                  }
                }
                
                return row;
              }

              function appendAgencyRows(rowsHost, fromIndex, toIndex){
                var fragment = document.createDocumentFragment();
                for (var i = fromIndex; i < toIndex; i++) {
                  var agent = agencyPerfState.sorted[i];
                  if (!agent) break;
                  fragment.appendChild(agentRowNode(agent, i));
                }
                rowsHost.appendChild(fragment);
              }

              function renderAgencyPerformance(agents){
                var rowsHost = document.getElementById('leaderboard-all-rows');
                if (!rowsHost) return;
                try {
                  var prevScrollTop = rowsHost.scrollTop || 0;
                  var safeAgents = (Array.isArray(agents) ? agents : [])
                    .map(function(a, idx){ return normalizeAgent(a, idx); })
                    .filter(function(a){ return !!a; });
                  var rawHash = hashAgentsLightweight(safeAgents);
                  if (agencyPerfState.rawHash === rawHash) return;
                  agencyPerfState.rawHash = rawHash;
                  var sorted = safeAgents.slice().sort(function(a, b){
                    var diff = agencyScore(b) - agencyScore(a);
                    if (diff !== 0) return diff;
                    if (b.booked !== a.booked) return b.booked - a.booked;
                    if (b.reach !== a.reach) return b.reach - a.reach;
                    return b.dials - a.dials;
                  });
                  var signature = hashAgentsLightweight(sorted);

                  if (agencyPerfState.hash !== signature) {
                    agencyPerfState.hash = signature;
                    agencyPerfState.sorted = sorted;
                    
                    // Render all agents - simple approach
                    var fragment = document.createDocumentFragment();
                    for (var i = 0; i < sorted.length; i++) {
                      var agent = sorted[i];
                      if (!agent) break;
                      fragment.appendChild(agentRowNode(agent, i));
                    }
                    while (rowsHost.firstChild) rowsHost.removeChild(rowsHost.firstChild);
                    rowsHost.appendChild(fragment);
                    rowsHost.scrollTop = prevScrollTop;
                  }
                } catch (err) {
                  console.error('Live agency performance render error:', err);
                }
              }

              function drawChart(chart){
                
                var canvas = document.getElementById('chart');
                if (!canvas) return;
                var ctx = canvas.getContext('2d');
                if (!ctx) return;
                canvas.width = canvas.offsetWidth * 3;
                canvas.height = canvas.offsetHeight * 3;
                ctx.setTransform(1,0,0,1,0,0);
                ctx.scale(3,3);

                var chartData = chart || { labels: [], series: [] };
                var series = Array.isArray(chartData.series) && chartData.series.length > 0 ? chartData.series.map(function(v){ return Number(v || 0); }) : [0, 0];
                var labels = Array.isArray(chartData.labels) && chartData.labels.length === series.length ? chartData.labels : series.map(function(){ return ''; });
                var minValue = Math.min.apply(null, series.concat([0]));
                var maxValue = Math.max.apply(null, series.concat([0, 1]));
                var valueRange = Math.max(1, maxValue - minValue);
                var padding = 22;
                var chartWidth = canvas.width / 3 - padding * 2;
                var chartHeight = canvas.height / 3 - padding * 2;
                var zeroY = padding + ((maxValue - 0) / valueRange) * chartHeight;

                ctx.clearRect(0, 0, canvas.width / 3, canvas.height / 3);
                ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
                ctx.lineWidth = 0.8;
                for (var i = 0; i <= 4; i++) {
                  var gy = padding + (chartHeight / 4) * i;
                  ctx.beginPath(); ctx.moveTo(padding, gy); ctx.lineTo(padding + chartWidth, gy); ctx.stroke();
                }

                var xStep = series.length > 1 ? (chartWidth / (series.length - 1)) : 0;
                var points = series.map(function(v, index){
                  var x = padding + (xStep * index);
                  var y = padding + ((maxValue - v) / valueRange) * chartHeight;
                  return { x: x, y: y };
                });
                var last = points[points.length - 1];

                var fillGradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
                fillGradient.addColorStop(0, 'rgba(59, 130, 246, 0.72)');
                fillGradient.addColorStop(0.52, 'rgba(37, 99, 235, 0.46)');
                fillGradient.addColorStop(1, 'rgba(37, 99, 235, 0.20)');
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (var p = 1; p < points.length; p++) {
                  var midX = (points[p - 1].x + points[p].x) / 2;
                  var midY = (points[p - 1].y + points[p].y) / 2;
                  ctx.quadraticCurveTo(points[p - 1].x, points[p - 1].y, midX, midY);
                }
                ctx.lineTo(last.x, last.y);
                ctx.lineTo(last.x, zeroY);
                ctx.lineTo(points[0].x, zeroY);
                ctx.closePath();
                ctx.fillStyle = fillGradient;
                ctx.fill();

                var lineGradient = ctx.createLinearGradient(padding, 0, padding + chartWidth, 0);
                lineGradient.addColorStop(0, '#60A5FA');
                lineGradient.addColorStop(1, '#2563EB');
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (var q = 1; q < points.length; q++) {
                  var mx = (points[q - 1].x + points[q].x) / 2;
                  var my = (points[q - 1].y + points[q].y) / 2;
                  ctx.quadraticCurveTo(points[q - 1].x, points[q - 1].y, mx, my);
                }
                ctx.lineTo(last.x, last.y);
                ctx.strokeStyle = lineGradient;
                ctx.lineWidth = 3.2;
                ctx.shadowBlur = 16;
                ctx.shadowColor = 'rgba(59,130,246,0.72)';
                ctx.stroke();
                ctx.shadowBlur = 0;

                var container = canvas.parentElement;
                if (container) {
                  var dot = container.querySelector('.live-chart-dot');
                  if (!dot) {
                    dot = document.createElement('div');
                    dot.className = 'live-chart-dot';
                    container.appendChild(dot);
                  }
                  dot.style.left = last.x + 'px';
                  dot.style.top = last.y + 'px';
                }

                ctx.fillStyle = 'rgba(203, 213, 225, 0.92)';
                ctx.font = '600 10px -apple-system';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                labels.forEach(function(label, index){
                  if (!label) return;
                  var lx = padding + (xStep * index);
                  ctx.fillText(label, lx, canvas.height / 3 - 6);
                });
              }

              function applyLiveData(data){
                if (!data || !data.totals) return;
                
                // Queue updates during touch, apply after touch ends
                var now = Date.now();
                if (agencyPerfState.isTouching || now < agencyPerfState.touchLockUntil || now < globalTouchLockUntil) {
                  pendingUpdate = data;
                  return;
                }
                
                // Apply pending update if it exists
                if (pendingUpdate) {
                  data = pendingUpdate;
                  pendingUpdate = null;
                }
                
                var date = new Date(data.generatedAt || Date.now());
                var timeEl = document.getElementById('time-display');
                if (timeEl) {
                  timeEl.textContent = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                }
                var totals = data.totals || {};
                var totalAgents = Number(totals.totalAgents || 0);
                var d = document.getElementById('kpi-agents'); if (d) d.textContent = String(Number(totals.activeAgents || 0)) + '/' + String(totalAgents);
                d = document.getElementById('kpi-dials-number'); if (d) d.textContent = Number(totals.dials || 0).toLocaleString();
                d = document.getElementById('kpi-reach-number'); if (d) d.textContent = Number(totals.reach || 0).toLocaleString();
                d = document.getElementById('kpi-booked-number'); if (d) d.textContent = Number(totals.booked || 0).toLocaleString();
                d = document.getElementById('kpi-instant-number'); if (d) d.textContent = Number(totals.instant || 0).toLocaleString();
                d = document.getElementById('kpi-connects-number'); if (d) d.textContent = Number(totals.connects || 0).toLocaleString();
                d = document.getElementById('kpi-missed-number'); if (d) d.textContent = Number(totals.missedCalls || 0).toLocaleString();

                var deltaPct = Number(totals.deltaPct || 0);
                var deltaEl = document.getElementById('delta-value');
                if (deltaEl) {
                  var isUp = deltaPct >= 0;
                  deltaEl.textContent = (isUp ? '+' : '-') + Math.round(Math.abs(deltaPct)) + '%';
                  deltaEl.style.color = isUp ? '#10B981' : '#EF4444';
                }

                var weeklyProductionEst = Number(totals.weeklyProductionEst || Math.round(Number(totals.booked || 0) * 220));
                var previousWeeksALP = Number(totals.previousWeeksALP || 89000);
                var weeklyProgress = Math.min(100, Math.max(8, Math.round((weeklyProductionEst / Math.max(previousWeeksALP, 1)) * 100)));
                var weeklyChange = weeklyProductionEst - previousWeeksALP;
                var weeklyChangePct = previousWeeksALP > 0 ? (weeklyChange / previousWeeksALP) * 100 : 0;
                var weeklyUp = weeklyChange >= 0;
                var goalPercentEl = document.getElementById('goal-percent');
                var goalFillEl = document.getElementById('goal-bar-fill');
                var goalTargetEl = document.getElementById('goal-target');
                var goalChangeEl = document.getElementById('goal-change');
                if (goalPercentEl) goalPercentEl.textContent = asCurrency(weeklyProductionEst);
                if (goalFillEl) goalFillEl.style.width = weeklyProgress + '%';
                if (goalTargetEl) goalTargetEl.textContent = 'Previous Weeks ALP: ' + asCurrency(previousWeeksALP);
                if (goalChangeEl) {
                  goalChangeEl.textContent = 'Change: ' + (weeklyUp ? '+' : '-') + asCurrency(Math.abs(weeklyChange)) + ' (' + (weeklyUp ? '+' : '-') + Math.abs(weeklyChangePct).toFixed(1) + '%) ' + (weeklyUp ? '▲' : '▼');
                  goalChangeEl.className = 'goal-change ' + (weeklyUp ? 'up' : 'down');
                }

                renderAgencyPerformance(data.agents || []);
                
                // Debounce chart redraws (max once per 500ms) - clear timer if touching
                var chartData = data.chart || { labels: [], series: [] };
                var now = Date.now();
                if (agencyPerfState.isTouching || now < agencyPerfState.touchLockUntil || now < globalTouchLockUntil) {
                  // Clear debounce timer if touch starts - don't queue chart redraw during touch
                if (chartState.debounceTimer) clearTimeout(chartState.debounceTimer);
                chartState.debounceTimer = setTimeout(function(){
                  drawChart(chartData);
                  chartState.debounceTimer = null;
                }, 300);
              }

              function normalizeLayoutForLive(){
                var titles = document.querySelectorAll('.leaderboard-section-title');
                if (titles && titles[0]) titles[0].textContent = 'AGENCY PERFORMANCE';
                var sections = document.querySelectorAll('.leaderboard-section');
                if (sections && sections[1]) sections[1].style.display = 'none';
              }

              async function fetchAndApply(){
                if ((window).__liveFetchInFlight) return;
                (window).__liveFetchInFlight = true;
                try {
                  var response = await fetch(realtimeEndpoint, { credentials: 'include' });
                  if (!response.ok) return;
                  var payload = await response.json();
                  applyLiveData(payload);
                } catch (_err) {
                } finally {
                  (window).__liveFetchInFlight = false;
                }
              }

              function wireLiveStream(){
                if (isPhoneClient) {
                  // Mobile safe mode: polling is more stable than SSE on iOS Safari/WebView.
                  if (!pollTimer) {
                    pollTimer = setInterval(fetchAndApply, 15000);
                  }
                  return;
                }

                var connect = function(){
                  try {
                    if (liveEs) {
                      try { liveEs.close(); } catch (_e) {}
                      liveEs = null;
                    }
                    liveEs = new EventSource(streamEndpoint);
                    liveEs.addEventListener('snapshot', function(){ fetchAndApply(); });
                    liveEs.onerror = function(){
                      fetchAndApply();
                      if (reconnectTimer) return;
                      reconnectTimer = setTimeout(function(){
                        reconnectTimer = null;
                        connect();
                      }, 3000);
                    };
                  } catch (_err) {
                    if (!pollTimer) {
                      pollTimer = setInterval(fetchAndApply, 15000);
                    }
                  }
                };

                connect();
              }

              fitCard();
              normalizeLayoutForLive();
              fetchAndApply();
              wireLiveStream();
              window.addEventListener('resize', fitCard);

              // Prevent pinch/double-tap zoom on iOS
              document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, { passive: false });
              document.addEventListener('gesturechange', function(e){ e.preventDefault(); }, { passive: false });
              document.addEventListener('gestureend', function(e){ e.preventDefault(); }, { passive: false });

              // Prevent double-tap zoom
              var lastTouchEnd = 0;
              document.addEventListener('touchend', function(e){
                var now = Date.now();
                if (now - lastTouchEnd <= 300) e.preventDefault();
                lastTouchEnd = now;
              }, { passive: false });
            })();
          </script></body>`
        );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    } catch (error: any) {
      return res.status(500).send(String(error?.message || error));
    }
  });

  app.get('/api/public/live-card/:identifier/realtime-data', async (req, res) => {
    try {
      const identifier = String(req.params.identifier || '').trim();
      if (!identifier) return res.status(400).json({ error: 'Missing identifier' });
      
      // Special handling for "aoi" identifier - hierarchy owners card
      if (identifier.toLowerCase() === 'aoi') {
        try {
          console.log('🔥 AOI Card Realtime: Starting hierarchy owners fetch...');
          
          // AOI card: only MGA (not RGA)
          const { data: hierarchyData, error: hierarchyError } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('mga_associate_id, mga_name')
            .not('mga_associate_id', 'is', null)
            .limit(1000);
          
          if (hierarchyError) {
            console.error('❌ AOI Card Realtime: Error fetching hierarchy data:', hierarchyError);
            throw hierarchyError;
          }
          
          const ownerMap = new Map<string, { email: string; name: string; type: 'mga' | 'rga' }>();
          if (hierarchyData && hierarchyData.length > 0) {
            const mgaAssociateIds = [...new Set((hierarchyData as any[]).map(r => Number(r.mga_associate_id)).filter(id => id > 0))];
            if (mgaAssociateIds.length > 0) {
              const { data: customers, error: customersError } = await supabaseAdmin
                .from('customers')
                .select('associate_id, company_email, first_name, last_name')
                .in('associate_id', mgaAssociateIds);
              if (!customersError && customers?.length) {
                const customerMap = new Map<number, any>();
                (customers as any[]).forEach((c: any) => { if (c.associate_id) customerMap.set(Number(c.associate_id), c); });
                for (const row of hierarchyData as any[]) {
                  const mgaId = Number(row.mga_associate_id);
                  if (mgaId <= 0) continue;
                  const customer = customerMap.get(mgaId);
                  if (customer?.company_email) {
                    const email = String(customer.company_email).toLowerCase().trim();
                    if (!ownerMap.has(email)) {
                      ownerMap.set(email, {
                        email,
                        name: String(row.mga_name || `${customer.first_name || ''} ${customer.last_name || ''}`).trim() || 'Unknown',
                        type: 'mga'
                      });
                    }
                  }
                }
              }
            }
          }
          
          const owners = Array.from(ownerMap.values());
          console.log(`📊 AOI Card Realtime: Processing ${owners.length} MGA owners in batches...`);
          
          // Process owners in batches of 10 to prevent timeouts
          const batchSize = 10;
          const ownerPayloads: PromiseSettledResult<{ owner: any; payload: any; liveAgents: any[] }>[] = [];
          
          for (let i = 0; i < owners.length; i += batchSize) {
            const batch = owners.slice(i, i + batchSize);
            console.log(`📦 AOI Card Realtime: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(owners.length / batchSize)} (${batch.length} owners)...`);
            
            const batchResults = await Promise.allSettled(
              batch.map(async (owner) => {
                try {
                  const scope = await getManagerScope(owner.email);
                  const dateRange = normalizeDateRange();
                  const freshSnapshot = await buildSnapshotForScope(scope, dateRange);
                  const payload = await buildActivityCardPayload({
                    scopeKey: scope.scopeKey,
                    managerName: scope.managerName,
                    managerEmail: scope.managerEmail,
                    agentEmails: scope.agentEmails,
                    hierarchyNameByEmail: scope.hierarchyNameByEmail,
                  });
                  return { owner, payload, liveAgents: freshSnapshot.fullRank };
                } catch (err: any) {
                  console.error(`❌ AOI Card Realtime: Error processing owner ${owner.email}:`, err.message);
                  throw err;
                }
              })
            );
            
            ownerPayloads.push(...batchResults);
          }
          
          // Convert hierarchy owners to "agent" format with their agency totals
          const ownerAgents: any[] = [];
          const allTotals = {
            activeAgents: 0,
            totalAgents: 0,
            dials: 0,
            reach: 0,
            booked: 0,
            instant: 0,
            connects: 0,
            missedCalls: 0,
            aoiUsage: 0,
          };
          
          // Track unique agents across all owners to prevent double counting
          const uniqueAgentsMap = new Map<string, {
            email: string;
            dials: number;
            reach: number;
            booked: number;
            instant: number;
            connects: number;
            missedCalls: number;
            aoiUsage: number;
          }>();
          
          let successCount = 0;
          let failedCount = 0;
          const failedOwners: string[] = [];
          
          for (const result of ownerPayloads) {
            if (result.status === 'fulfilled') {
              try {
                const { owner, payload, liveAgents } = result.value;
                const totals = payload.totals || {};
                
                // Get owner photo
                const { data: profile } = await supabaseAdmin
                  .from('agent_profiles')
                  .select('profile_picture')
                  .eq('email', owner.email)
                  .maybeSingle();
                
                // Calculate totals from live agents
                const ownerDials = liveAgents.reduce((s: number, a: any) => s + Number(a?.dials || 0), 0);
                const ownerReach = liveAgents.reduce((s: number, a: any) => s + Number(a?.reach || 0), 0);
                const ownerBooked = liveAgents.reduce((s: number, a: any) => s + Number(a?.booked || 0), 0);
                const ownerInstant = liveAgents.reduce((s: number, a: any) => s + Number(a?.instant || 0), 0);
                const ownerConnects = liveAgents.reduce((s: number, a: any) => s + Number(a?.connects || 0), 0);
                const ownerMissedCalls = liveAgents.reduce((s: number, a: any) => s + Number(a?.missedCalls || 0), 0);
                const ownerAoiUsage = Math.round(liveAgents.reduce((s: number, a: any) => s + Number(a?.aoiUsage || 0), 0) / Math.max(1, liveAgents.length));
                
                // Create owner as "agent" with their agency totals
                ownerAgents.push({
                  name: owner.name,
                  email: owner.email,
                  dials: ownerDials,
                  reach: ownerReach,
                  booked: ownerBooked,
                  instant: ownerInstant,
                  connects: ownerConnects,
                  missedCalls: ownerMissedCalls,
                  aoiUsage: ownerAoiUsage,
                  rank: 0, // Will be calculated by sorting
                  rankChange: 0,
                  photoUrl: profile?.profile_picture || null,
                  agents: liveAgents, // Store their agents for accordion
                });
                
                // Track unique agents to prevent double counting in totals
                // (An agent might appear under multiple owners, so we only count them once)
                for (const agent of liveAgents || []) {
                  const agentEmail = String(agent?.email || '').toLowerCase().trim();
                  if (!agentEmail) continue;
                  
                  if (!uniqueAgentsMap.has(agentEmail)) {
                    uniqueAgentsMap.set(agentEmail, {
                      email: agentEmail,
                      dials: Number(agent?.dials || 0),
                      reach: Number(agent?.reach || 0),
                      booked: Number(agent?.booked || 0),
                      instant: Number(agent?.instant || 0),
                      connects: Number(agent?.connects || 0),
                      missedCalls: Number(agent?.missedCalls || 0),
                      aoiUsage: Number(agent?.aoiUsage || 0),
                    });
                  }
                }
                
                successCount++;
              } catch (err: any) {
                failedCount++;
                const ownerEmail = result.value?.owner?.email || 'unknown';
                failedOwners.push(ownerEmail);
                console.error(`❌ AOI Card Realtime: Error processing owner data for ${ownerEmail}:`, err.message);
              }
            } else {
              failedCount++;
              const ownerEmail = (result as any).value?.owner?.email || 'unknown';
              failedOwners.push(ownerEmail);
              console.error(`❌ AOI Card Realtime: Failed to process owner ${ownerEmail}:`, result.reason?.message || result.reason);
            }
          }
          
          // Calculate totals from unique agents only (no double counting)
          for (const agent of uniqueAgentsMap.values()) {
            allTotals.activeAgents += 1;
            allTotals.dials += agent.dials;
            allTotals.reach += agent.reach;
            allTotals.booked += agent.booked;
            allTotals.instant += agent.instant;
            allTotals.connects += agent.connects;
            allTotals.missedCalls += agent.missedCalls;
            allTotals.aoiUsage += agent.aoiUsage;
          }
          
          // totalAgents = unique agents (no double-count when agent reports to multiple MGAs)
          allTotals.totalAgents = uniqueAgentsMap.size;
          
          if (failedCount > 0) {
            console.warn(`⚠️ AOI Card Realtime: ${failedCount} owners failed to process: ${failedOwners.join(', ')}`);
          }
          
          console.log(`✅ AOI Card Realtime: Successfully processed ${successCount}/${owners.length} owners (${failedCount} failed)`);
          
          // Sort owners by performance score
          const score = (a: any) => (a.dials * 1) + (a.reach * 10) + (a.booked * 40) + (a.connects * 25) + (a.instant * 80);
          ownerAgents.sort((a, b) => {
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            if (b.booked !== a.booked) return b.booked - a.booked;
            if (b.reach !== a.reach) return b.reach - a.reach;
            return b.dials - a.dials;
          });
          
          // Assign ranks
          ownerAgents.forEach((agent, idx) => {
            agent.rank = idx + 1;
          });
          
          const mergedTotals = {
            ...allTotals,
            dialsPct: 0,
            dialsTrend: 'up' as const,
            reachPct: 0,
            reachTrend: 'up' as const,
            bookedPct: 0,
            bookedTrend: 'up' as const,
            instantPct: 0,
            instantTrend: 'up' as const,
            connectsPct: 0,
            connectsTrend: 'up' as const,
            missedCallsPct: 0,
            missedCallsTrend: 'up' as const,
            aoiUsagePct: 0,
            aoiUsageTrend: 'up' as const,
            deltaPct: 0,
            weeklyProductionEst: Math.round(allTotals.booked * 100 + allTotals.instant * 200 + allTotals.connects * 250),
            previousWeeksALP: 89000,
          };
          
          return res.json({
            generatedAt: new Date().toISOString(),
            totals: mergedTotals,
            chart: { labels: [], series: [] },
            agents: ownerAgents,
          });
        } catch (aoiError: any) {
          console.error('❌ AOI Card Realtime: Error generating data:', aoiError);
          return res.status(500).json({ error: 'Failed to load AOI card data', details: String(aoiError?.message || aoiError) });
        }
      }
      
      const snapshot = await getSnapshotByToken(identifier);
      if (!snapshot) return res.status(404).json({ error: 'Link not found or disabled' });

      const scope = await getManagerScope(snapshot.managerEmail);
      
      // CRITICAL FIX: Use fresh calculation instead of stale snapshot
      const dateRange = normalizeDateRange();
      const freshSnapshot = await buildSnapshotForScope(scope, dateRange);
      const liveAgents = freshSnapshot.fullRank; // This contains ALL active agents
      
      const payload = await buildActivityCardPayload({
        scopeKey: scope.scopeKey,
        managerName: scope.managerName,
        managerEmail: scope.managerEmail,
        agentEmails: scope.agentEmails,
        hierarchyNameByEmail: scope.hierarchyNameByEmail,
      });

      const liveTotals = {
        activeAgents: liveAgents.length,
        totalAgents: Number((payload as any)?.totals?.totalAgents || scope.agentEmails.length || 0),
        dials: liveAgents.reduce((s: number, a: any) => s + Number(a?.dials || 0), 0),
        reach: liveAgents.reduce((s: number, a: any) => s + Number(a?.reach || 0), 0),
        booked: liveAgents.reduce((s: number, a: any) => s + Number(a?.booked || 0), 0),
        instant: liveAgents.reduce((s: number, a: any) => s + Number(a?.instant || 0), 0),
        connects: liveAgents.reduce((s: number, a: any) => s + Number(a?.connects || 0), 0),
        missedCalls: liveAgents.reduce((s: number, a: any) => s + Number(a?.missedCalls || 0), 0),
        aoiUsage: Math.round(liveAgents.reduce((s: number, a: any) => s + Number(a?.aoiUsage || 0), 0) / Math.max(1, liveAgents.length)),
      };

      const mergedTotals = {
        ...(payload as any).totals,
        ...liveTotals,
      };

      return res.json({
        generatedAt: payload.generatedAt,
        totals: mergedTotals,
        chart: payload.chart,
        agents: liveAgents,
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to load realtime live card data', details: error?.message || String(error) });
    }
  });

  app.post('/api/public/live-card/refresh-all', async (_req, res) => {
    try {
      const updated = await rebuildAllLiveSnapshots();
      return res.json({ success: true, updated });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to refresh all snapshots', details: error?.message || String(error) });
    }
  });

  app.post('/api/public/live-card/refresh/:managerEmail', async (req, res) => {
    try {
      const managerEmail = String(req.params.managerEmail || '').toLowerCase().trim();
      if (!managerEmail.includes('@')) return res.status(400).json({ error: 'Invalid manager email' });
      await rebuildSnapshotForManager(managerEmail);
      return res.json({ success: true, managerEmail });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to refresh manager snapshot', details: error?.message || String(error) });
    }
  });

  app.get('/api/public/live-card/link/:managerEmail', async (req, res) => {
    try {
      await ensurePublicLiveCardTables();
      const managerEmail = String(req.params.managerEmail || '').toLowerCase().trim();
      if (!managerEmail.includes('@')) return res.status(400).json({ error: 'Invalid manager email' });
      const link = await getOrCreatePermanentHierarchyLink(managerEmail);
      await rebuildSnapshotForManager(link.managerEmail);
      return res.json({
        token: link.token,
        vanitySlug: link.vanitySlug,
        scopeKey: link.scopeKey,
        managerEmail: link.managerEmail,
        managerName: link.managerName,
        urlPath: `/${link.vanitySlug || link.token}`,
        fallbackUrlPath: `/live/${link.token}`,
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to create/get link', details: error?.message || String(error) });
    }
  });

  app.get('/api/public/live-card/seed/chris', async (_req, res) => {
    try {
      const out = await seedChrisLiveLink();
      return res.json(out);
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to seed Chris link', details: error?.message || String(error) });
    }
  });
}

