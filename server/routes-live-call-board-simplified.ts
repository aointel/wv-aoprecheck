// Live Call Board agents endpoint - NO LONGER USES live_call_boardt TABLE
// Queries stats directly from agent_dial_metrics and twilio_call_logs
// Uses agent_profiles as source of truth for MGA/RGA data

// Note: This file assumes 'app', 'checkMgaRgaAccess', 'supabaseAdmin', and 'getDateRangeForTimePeriod' are available in scope
// These are provided when this file is included/inlined into routes.ts

app.get("/api/live-call-board/agents", checkMgaRgaAccess, async (req, res) => {
  try {
    // Normalize filter values - treat empty strings, undefined, null as "no filter"
    const mgaFilterRaw = req.query.mgaFilter as string | undefined;
    const rgaFilterRaw = req.query.rgaFilter as string | undefined;
    const mgaFilter = mgaFilterRaw && mgaFilterRaw.trim() !== '' ? mgaFilterRaw : undefined;
    const rgaFilter = rgaFilterRaw && rgaFilterRaw.trim() !== '' ? rgaFilterRaw : undefined;
    
    console.log(`🔍 API called with filters: mgaFilter="${mgaFilterRaw}" (normalized: ${mgaFilter}), rgaFilter="${rgaFilterRaw}" (normalized: ${rgaFilter})`);
    
    const userEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string);
    // For non-super-admins richiealtig@aoglobelife.com and cnsysop@aoglobelife.com, filter by hierarchy
    // Only chrislafond@aoglobelife.com and nateschoot@aoglobelife.com are true super admins who see all
    const isSysOp = userEmail?.toLowerCase() === 'chrislafond@aoglobelife.com' || userEmail?.toLowerCase() === 'nateschoot@aoglobelife.com';
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Get user's associate_id for filtering
    let userAssociateId: number | null = null;
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .or(`company_email.eq.${userEmail?.toLowerCase().trim()},personal_email.eq.${userEmail?.toLowerCase().trim()}`)
      .maybeSingle();
    
    if (customer?.associate_id) {
      userAssociateId = customer.associate_id;
    }

    // Get date range based on time period (default to 'realtime' which is today in EST)
    // Handle custom date range
    const timePeriod = (req.query.timePeriod as 'day' | 'week' | 'month' | 'realtime' | 'custom') || 'realtime';
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;
    const { start: dateStart, end: dateEnd } = getDateRangeForTimePeriod(
      timePeriod,
      customStartDate,
      customEndDate
    );
    
    console.log(`📅 Live Call Board agents date range (${timePeriod}): ${dateStart.toISOString()} to ${dateEnd.toISOString()}`);

    // CRITICAL FIX: Only count connects from billing_transactions - this is the source of truth
    // vdp_calls are already synced to billing_transactions, so counting both causes duplicates!
    // billing_transactions has ALL connects (from vdp_calls, AO Intel, etc.) and is the authoritative source
    
    // Get connects from billing_transactions ONLY (includes ALL connects from all sources)
    // CRITICAL: Paginate to get ALL records - Supabase defaults to 1000 row limit
    // CRITICAL: Only count 'connect' type, NOT 'missed_call' - these are separate!
    const billingConnectsData: any[] = [];
    let billingOffset = 0;
    const billingBatchSize = 1000;
    let hasMoreBilling = true;
    
    while (hasMoreBilling) {
      const { data: billingBatch, error: billingError } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, transaction_type, transaction_id, source_table, source_id')
        .eq('transaction_type', 'connect') // CRITICAL: Only 'connect', NOT 'missed_call'
        .gte('transaction_date', dateStart.toISOString())
        .lt('transaction_date', dateEnd.toISOString())
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .order('transaction_date', { ascending: false })
        .range(billingOffset, billingOffset + billingBatchSize - 1);
      
      if (billingError) {
        console.error('❌ Error fetching billing_transactions for connects:', billingError);
        hasMoreBilling = false;
        break;
      }
      
      if (billingBatch && billingBatch.length > 0) {
        // CRITICAL: Filter out ANY records that aren't exactly 'connect' (defense in depth)
        const validConnects = billingBatch.filter((row: any) => {
          const isValid = row.transaction_type === 'connect' && row.transaction_type !== 'missed_call';
          if (!isValid) {
            console.error(`❌ CRITICAL BUG: Query returned non-connect transaction: ${row.transaction_id} type="${row.transaction_type}" for ${row.agent_email}`);
          }
          return isValid;
        });
        
        billingConnectsData.push(...validConnects);
        billingOffset += billingBatchSize;
        
        if (billingBatch.length < billingBatchSize) {
          hasMoreBilling = false;
        }
      } else {
        hasMoreBilling = false;
      }
    }
    
    // CRITICAL: Final filter - remove ANY records that aren't exactly 'connect'
    const validConnectsOnly = billingConnectsData.filter((row: any) => {
      const isValid = row.transaction_type === 'connect';
      if (!isValid) {
        console.error(`❌ CRITICAL BUG: Non-connect transaction in results: ${row.transaction_id} type="${row.transaction_type}" for ${row.agent_email}`);
      }
      return isValid;
    });
    
    // CRITICAL VERIFICATION: Direct database query to verify what danielbeasley actually has
    const { data: danielDirectQuery } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, transaction_type, agent_email, transaction_date')
      .or(`agent_email.ilike.%danielbeasley%,agent_email.ilike.%beasley%`)
      .gte('transaction_date', dateStart.toISOString())
      .lt('transaction_date', dateEnd.toISOString())
      .order('transaction_date', { ascending: false });
    
    if (danielDirectQuery && danielDirectQuery.length > 0) {
      const danielConnects = danielDirectQuery.filter(t => t.transaction_type === 'connect');
      const danielMissed = danielDirectQuery.filter(t => t.transaction_type === 'missed_call');
      console.log(`\n🔍 DIRECT DB QUERY for danielbeasley (${dateStart.toISOString()} to ${dateEnd.toISOString()}):`);
      console.log(`   ✅ Connects: ${danielConnects.length}`);
      console.log(`   ❌ Missed calls: ${danielMissed.length}`);
      console.log(`   📊 Total transactions: ${danielDirectQuery.length}`);
      
      if (danielConnects.length > 0) {
        console.log(`\n   📞 ACTUAL CONNECTS:`);
        danielConnects.forEach((t, i) => {
          console.log(`      ${i + 1}. ${t.transaction_id} | ${t.transaction_date}`);
        });
      }
      
      if (danielMissed.length > 0) {
        console.log(`\n   📵 MISSED CALLS (should NOT be in connects count):`);
        danielMissed.slice(0, 10).forEach((t, i) => {
          console.log(`      ${i + 1}. ${t.transaction_id} | ${t.transaction_date}`);
        });
        if (danielMissed.length > 10) {
          console.log(`      ... and ${danielMissed.length - 10} more missed calls`);
        }
      }
    }
    
    // CRITICAL VERIFICATION: Check if danielbeasley has any records in the query results
    const danielInResults = validConnectsOnly.filter((row: any) => 
      row.agent_email && (String(row.agent_email).toLowerCase().includes('danielbeasley') || String(row.agent_email).toLowerCase().includes('beasley'))
    );
    if (danielInResults.length > 0) {
      console.log(`\n🔍 VERIFICATION: danielbeasley has ${danielInResults.length} connects in FILTERED query results:`);
      danielInResults.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.transaction_id} | type="${row.transaction_type}" | ${row.agent_email} | ${row.transaction_date || 'N/A'}`);
      });
    } else {
      console.log(`\n🔍 VERIFICATION: danielbeasley has 0 connects in FILTERED query results (this is correct if he only has missed calls)`);
    }
    
    console.log(`📊 Found ${validConnectsOnly.length} VALID connects from billing_transactions (filtered from ${billingConnectsData.length} total records)`);
    
    // Count connects per email from billing_transactions ONLY
    const connectsMap = new Map<string, number>();
    
    // Add connects from billing_transactions (this is the ONLY source - no duplicates!)
    // CRITICAL: Only count records that passed the filter
    validConnectsOnly.forEach((row: any) => {
      if (row.agent_email) {
        const email = String(row.agent_email).toLowerCase().trim();
        connectsMap.set(email, (connectsMap.get(email) || 0) + 1);
      }
    });
    
    // Verify no missed calls made it through
    const missedCallsInConnects = validConnectsOnly.filter((row: any) => row.transaction_type === 'missed_call');
    if (missedCallsInConnects.length > 0) {
      console.error(`❌ CRITICAL BUG: ${missedCallsInConnects.length} missed calls found in connects data! This should be IMPOSSIBLE!`);
      missedCallsInConnects.forEach((row: any) => {
        console.error(`   BUG: ${row.transaction_id} | type="${row.transaction_type}" | ${row.agent_email}`);
      });
    }
    
    // DEBUG: Check for danielbeasley specifically - show ALL connects being counted
    const danielbeasleyConnects = Array.from(connectsMap.entries()).filter(([email]) => 
      email.includes('danielbeasley') || email.includes('beasley')
    );
    if (danielbeasleyConnects.length > 0) {
      console.log(`🔍 DEBUG danielbeasley connects in map:`, danielbeasleyConnects);
      
      // Get TODAY's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      // Check what's in billing_transactions for danielbeasley TODAY (ALL transaction types)
      const { data: danielBillingToday } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id, transaction_type, agent_email, transaction_date, lead_name, lead_phone, source_table, source_id')
        .or(`agent_email.ilike.%danielbeasley%,agent_email.ilike.%beasley%`)
        .gte('transaction_date', todayStart.toISOString())
        .lt('transaction_date', todayEnd.toISOString())
        .order('transaction_date', { ascending: false });
      
      // Also check what the ACTUAL connects query returns for danielbeasley
      const { data: danielConnectsFromQuery } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id, transaction_type, agent_email, transaction_date')
        .eq('transaction_type', 'connect')
        .or(`agent_email.ilike.%danielbeasley%,agent_email.ilike.%beasley%`)
        .gte('transaction_date', todayStart.toISOString())
        .lt('transaction_date', todayEnd.toISOString())
        .order('transaction_date', { ascending: false });
      
      console.log(`\n🔍 DEBUG danielbeasley CONNECTS QUERY RESULT: ${danielConnectsFromQuery?.length || 0} records`);
      if (danielConnectsFromQuery && danielConnectsFromQuery.length > 0) {
        danielConnectsFromQuery.forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.transaction_id} | type="${t.transaction_type}" | ${t.transaction_date}`);
        });
      }
      
      if (danielBillingToday && danielBillingToday.length > 0) {
        const connects = danielBillingToday.filter(t => t.transaction_type === 'connect');
        const missed = danielBillingToday.filter(t => t.transaction_type === 'missed_call');
        console.log(`\n🔍 DEBUG danielbeasley TODAY (${todayStart.toISOString()} to ${todayEnd.toISOString()}):`);
        console.log(`   📊 Total billing transactions: ${danielBillingToday.length}`);
        console.log(`   ✅ Connects: ${connects.length}`);
        console.log(`   ❌ Missed calls: ${missed.length}`);
        
        if (connects.length > 0) {
          console.log(`\n   📞 CONNECTS DETAILS:`);
          connects.forEach((t, i) => {
            console.log(`      ${i + 1}. ${t.transaction_id} | ${t.transaction_date} | ${t.lead_name || 'N/A'} | ${t.lead_phone || 'N/A'} | source: ${t.source_table || 'N/A'} | source_id: ${t.source_id || 'N/A'}`);
          });
        }
        
        if (missed.length > 0) {
          console.log(`\n   📵 MISSED CALLS DETAILS:`);
          missed.forEach((t, i) => {
            console.log(`      ${i + 1}. ${t.transaction_id} | ${t.transaction_date} | ${t.lead_name || 'N/A'} | ${t.lead_phone || 'N/A'}`);
          });
        }
      }
      
      // Also check vdp_calls for today (for reference, but NOT counted in connects)
      const { data: danielVdpCallsToday } = await supabaseAdmin
        .from('vdp_calls')
        .select('id, company_email, phone, first_name, last_name, updated_at, time')
        .or(`company_email.ilike.%danielbeasley%,company_email.ilike.%beasley%`)
        .gte('updated_at', todayStart.toISOString())
        .lt('updated_at', todayEnd.toISOString())
        .order('updated_at', { ascending: false });
      
      if (danielVdpCallsToday && danielVdpCallsToday.length > 0) {
        console.log(`\n   📱 VDP_CALLS for danielbeasley TODAY: ${danielVdpCallsToday.length} calls (NOT counted in connects - already in billing_transactions)`);
        danielVdpCallsToday.forEach((call, i) => {
          console.log(`      ${i + 1}. ID: ${call.id} | ${call.updated_at || call.time} | ${call.first_name || ''} ${call.last_name || ''} | ${call.phone || 'N/A'}`);
        });
      }
      
      console.log(`\n   🎯 FINAL CONNECTS COUNT IN MAP: ${danielbeasleyConnects.reduce((sum, [, count]) => sum + count, 0)}\n`);
    }
    
    console.log(`✅ Total unique agents with connects: ${connectsMap.size}`);
    
    // CRITICAL: Also get ALL agents with ANY billing transactions (not just connects)
    // This ensures agents with missed calls, precheck, recruit, hotconnect also show up
    const allBillingTransactionsAgents = new Set<string>();
    billingConnectsData.forEach((row: any) => {
      if (row.agent_email) {
        allBillingTransactionsAgents.add(String(row.agent_email).toLowerCase().trim());
      }
    });
    // Also add agents from missed calls (already fetched below)
    // This will be populated when we fetch missed calls

    // Fetch missed calls from billing_transactions for the date range (similar to connects)
    // CRITICAL: Paginate to get ALL records - Supabase defaults to 1000 row limit
    console.log(`📞 Fetching missed calls for date range: ${dateStart.toISOString()} to ${dateEnd.toISOString()}`);
    const missedCallsData: any[] = [];
    let missedCallsOffset = 0;
    const missedCallsBatchSize = 1000;
    let hasMoreMissedCalls = true;
    
    while (hasMoreMissedCalls) {
      const { data: missedCallsBatch, error: missedCallsError } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, transaction_date')
        .eq('transaction_type', 'missed_call')
        .gte('transaction_date', dateStart.toISOString())
        .lt('transaction_date', dateEnd.toISOString())
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .order('transaction_date', { ascending: false })
        .range(missedCallsOffset, missedCallsOffset + missedCallsBatchSize - 1);
      
      if (missedCallsError) {
        console.error('❌ Error fetching billing_transactions for missed calls:', missedCallsError);
        hasMoreMissedCalls = false;
        break;
      }
      
      if (missedCallsBatch && missedCallsBatch.length > 0) {
        missedCallsData.push(...missedCallsBatch);
        missedCallsOffset += missedCallsBatchSize;
        
        if (missedCallsBatch.length < missedCallsBatchSize) {
          hasMoreMissedCalls = false;
        }
      } else {
        hasMoreMissedCalls = false;
      }
    }
    
    console.log(`📊 Found ${missedCallsData.length} missed calls from billing_transactions for date range`);
    
    // Debug: Check for specific agent
    const lanebeasleyMissedCalls = missedCallsData.filter((row: any) => 
      row.agent_email && String(row.agent_email).toLowerCase().trim().includes('lanebeasley')
    );
    if (lanebeasleyMissedCalls.length > 0) {
      console.log(`🔍 DEBUG: Found ${lanebeasleyMissedCalls.length} missed calls for lanebeasley in raw data:`, 
        lanebeasleyMissedCalls.map((r: any) => ({ 
          email: r.agent_email, 
          normalized: String(r.agent_email).toLowerCase().trim(),
          transaction_date: r.transaction_date
        }))
      );
    } else {
      console.log(`⚠️ DEBUG: No missed calls found for lanebeasley in date range ${dateStart.toISOString()} to ${dateEnd.toISOString()}`);
    }
    
    // Count missed calls per email
    const missedCallsMap = new Map<string, number>();
    missedCallsData.forEach((row: any) => {
      if (row.agent_email) {
        const email = String(row.agent_email).toLowerCase().trim();
        missedCallsMap.set(email, (missedCallsMap.get(email) || 0) + 1);
      }
    });
    
    console.log(`✅ Total unique agents with missed calls: ${missedCallsMap.size}`);
    // Debug: Log first 10 agents with missed calls
    const missedCallsEntries = Array.from(missedCallsMap.entries()).slice(0, 10);
    if (missedCallsEntries.length > 0) {
      console.log(`📞 Sample missed calls:`, missedCallsEntries.map(([email, count]) => `${email}: ${count}`).join(', '));
    }

    // CRITICAL: Get ALL agents from agent_profiles - THIS IS THE SOURCE OF TRUTH
    console.log('📋 Querying ALL agent_profiles for agents and MGA/RGA data...');
    const { data: agentProfilesData, error: agentProfilesError } = await supabaseAdmin
      .from('agent_profiles')
      .select('email, mga_team, rga_team, first_name, last_name')
      .limit(10000);
    
    if (agentProfilesError) {
      console.error('❌ Error fetching agent_profiles data:', agentProfilesError);
      return res.status(500).json({ error: 'Failed to fetch agent profiles', details: agentProfilesError.message });
    }
    
    console.log(`✅ Fetched ${agentProfilesData?.length || 0} agents from agent_profiles`);

    // FALLBACK: Get agents from agent_hierarchy (for agents not in agent_profiles)
    const { data: hierarchyAgents, error: hierarchyError } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email, agent_name, agent_associate_id, mga_name, mga_associate_id, rga_name, rga_associate_id')
      .limit(10000);
    
    if (hierarchyError) {
      console.error('❌ Error fetching agent_hierarchy:', hierarchyError);
    } else {
      console.log(`✅ Fetched ${hierarchyAgents?.length || 0} agents from agent_hierarchy`);
    }

    // HARDCODED: Always include these Carrington Hanna agents
    const carringtonAgentsHardcoded = [
      'cameronchristensen@aoglobelife.com',
      'calebbrown@aoglobelife.com',
      'gavinsynder@aoglobelife.com',
      'bradleesimmons@aoglobelife.com',
      'isaiahnewhouse@aoglobelife.com',
      'shawnsipes@aoglobelife.com',
      'averyflicky@aoglobelife.com',
      'tajward@aoglobelife.com',
      'alonzoalexander@aoglobelife.com',
      'willmusik@aoglobelife.com'
    ].map(e => e.toLowerCase().trim());

    // Build set of all agent emails from agent_profiles and agent_hierarchy
    const allAgentEmails = new Set<string>();
    
    // Add agents from agent_profiles
    (agentProfilesData || []).forEach(row => {
      if (row.email) {
        allAgentEmails.add(String(row.email).toLowerCase().trim());
      }
    });
    
    // Add agents from agent_hierarchy
    (hierarchyAgents || []).forEach(row => {
      if (row.agent_email) {
        allAgentEmails.add(String(row.agent_email).toLowerCase().trim());
      }
    });

    // HARDCODED: ALWAYS add Carrington agents
    carringtonAgentsHardcoded.forEach(agentEmail => {
      allAgentEmails.add(agentEmail);
    });
    
    // CRITICAL FIX: Add agents who have connects from billing_transactions but might not be in agent_profiles/agent_hierarchy
    // This ensures agents like fayesaad who only have connects from billing transactions show up
    connectsMap.forEach((connectCount, email) => {
      if (connectCount > 0) {
        allAgentEmails.add(email);
      }
    });
    
    // CRITICAL FIX: Add agents who have missed calls but might not be in agent_profiles/agent_hierarchy
    // This ensures agents with missed calls show up even if they have no other activity
    missedCallsMap.forEach((missedCallCount, email) => {
      if (missedCallCount > 0) {
        allAgentEmails.add(email);
      }
    });
    
    // CRITICAL FIX: Add agents with VDP online status (READY/online) even if not in agent_profiles/agent_hierarchy
    // This ensures agents who are currently online in VDP show up on the live call board
    try {
      const { taalkVDPPoller } = await import('./taalk-vdp-poller');
      const allVdpAgents = taalkVDPPoller.getAgents();
      const vdpOnlineAgents = allVdpAgents.filter(a => a.status === 'online' || a.status === 'calling');
      
      if (vdpOnlineAgents.length > 0) {
        vdpOnlineAgents.forEach(agent => {
          const email = agent.email?.toLowerCase().trim();
          if (email) {
            allAgentEmails.add(email);
          }
        });
        console.log(`✅ Added ${vdpOnlineAgents.length} agents with VDP online/calling status to agent list`);
        console.log(`📡 VDP Online agents: ${vdpOnlineAgents.slice(0, 10).map(a => a.email).join(', ')}${vdpOnlineAgents.length > 10 ? '...' : ''}`);
      }
    } catch (vdpError) {
      console.error('⚠️ Error adding agents with VDP status:', vdpError);
    }
    
    // CRITICAL FIX: Add agents who have usage data (online/active) but might not be in agent_profiles/agent_hierarchy
    // This ensures agents who are online/active show up even if they have no connects or missed calls
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      // CRITICAL: Build numeric email to real email lookup map BEFORE querying weekly_usage_stats
      // This prevents duplicate entries when weekly_usage_stats contains numeric emails
      const usageStatsNumericToRealEmail = new Map<string, string>();
      const usageStatsNumericEmails = new Set<string>();
      
      // Query weekly_usage_stats for current week to find agents with usage data
      const { data: weeklyStats } = await supabaseAdmin
        .from('weekly_usage_stats')
        .select('agent_email, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes, total_online_minutes')
        .eq('week_start_date', weekStartStr)
        .limit(10000);
      
      // Identify numeric emails from weekly_usage_stats
      if (weeklyStats && weeklyStats.length > 0) {
        weeklyStats.forEach((stat: any) => {
          const email = stat.agent_email?.toLowerCase()?.trim();
          if (!email) return;
          const emailPrefix = email.split('@')[0];
          // Check if email is numeric (all digits before @)
          if (/^\d+$/.test(emailPrefix) && parseInt(emailPrefix) > 0) {
            usageStatsNumericEmails.add(email);
          }
        });
      }
      
      // Look up real emails for numeric emails from customers table
      if (usageStatsNumericEmails.size > 0) {
        const numericAssociateIds = new Set<number>();
        usageStatsNumericEmails.forEach(numericEmail => {
          const assocId = parseInt(numericEmail.split('@')[0]);
          if (!isNaN(assocId)) numericAssociateIds.add(assocId);
        });
        
        if (numericAssociateIds.size > 0) {
          const assocIdArray = Array.from(numericAssociateIds);
          const batchSize = 100;
          for (let i = 0; i < assocIdArray.length; i += batchSize) {
            const batch = assocIdArray.slice(i, i + batchSize);
            const { data: customers } = await supabaseAdmin
              .from('customers')
              .select('associate_id, company_email, personal_email')
              .in('associate_id', batch);
            
            if (customers) {
              customers.forEach((customer: any) => {
                const realEmail = (customer.company_email || customer.personal_email)?.toLowerCase().trim();
                if (realEmail && customer.associate_id) {
                  // Map all numeric emails with this associate_id to the real email
                  usageStatsNumericEmails.forEach(numericEmail => {
                    const numericAssocId = parseInt(numericEmail.split('@')[0]);
                    if (numericAssocId === customer.associate_id) {
                      usageStatsNumericToRealEmail.set(numericEmail, realEmail);
                      console.log(`🔄 Usage stats: Mapping numeric email ${numericEmail} -> ${realEmail}`);
                    }
                  });
                }
              });
            }
          }
        }
      }
      
      if (weeklyStats && weeklyStats.length > 0) {
        weeklyStats.forEach((stat: any) => {
          const email = stat.agent_email?.toLowerCase()?.trim();
          if (!email) return;
          
          // CRITICAL: Replace numeric email with real email if mapping exists
          const realEmail = usageStatsNumericToRealEmail.get(email) || email;
          
          // Add agent if they have any usage data (online time, VDP activity, etc.)
          const hasUsage = (Number(stat.vdp_total_minutes) || 0) > 0 || 
                         (Number(stat.total_online_minutes) || 0) > 0 ||
                         (Number(stat.vdp_available_minutes) || 0) > 0 ||
                         (Number(stat.vdp_call_minutes) || 0) > 0;
          
          if (hasUsage) {
            // Add the REAL email, not the numeric email
            allAgentEmails.add(realEmail);
            // Store mapping for later stats merging
            if (realEmail !== email) {
              usageStatsNumericToRealEmail.set(email, realEmail);
            }
          }
        });
        console.log(`✅ Added ${weeklyStats.length} agents with usage data to agent list (mapped ${usageStatsNumericToRealEmail.size} numeric emails to real emails)`);
      } else {
        // Fallback: Try most recent week if current week has no data
        const { data: recentStats } = await supabaseAdmin
          .from('weekly_usage_stats')
          .select('agent_email, week_start_date, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes, total_online_minutes')
          .order('week_start_date', { ascending: false })
          .limit(1000);
        
        if (recentStats && recentStats.length > 0) {
          const mostRecentWeek = recentStats[0]?.week_start_date;
          const recentWeekStats = recentStats.filter((s: any) => s.week_start_date === mostRecentWeek);
          
          // Identify numeric emails from fallback stats
          const fallbackNumericEmails = new Set<string>();
          recentWeekStats.forEach((stat: any) => {
            const email = stat.agent_email?.toLowerCase()?.trim();
            if (!email) return;
            const emailPrefix = email.split('@')[0];
            if (/^\d+$/.test(emailPrefix) && parseInt(emailPrefix) > 0) {
              fallbackNumericEmails.add(email);
            }
          });
          
          // Look up real emails for fallback numeric emails
          if (fallbackNumericEmails.size > 0) {
            const fallbackAssociateIds = new Set<number>();
            fallbackNumericEmails.forEach(numericEmail => {
              const assocId = parseInt(numericEmail.split('@')[0]);
              if (!isNaN(assocId)) fallbackAssociateIds.add(assocId);
            });
            
            if (fallbackAssociateIds.size > 0) {
              const assocIdArray = Array.from(fallbackAssociateIds);
              const batchSize = 100;
              for (let i = 0; i < assocIdArray.length; i += batchSize) {
                const batch = assocIdArray.slice(i, i + batchSize);
                const { data: customers } = await supabaseAdmin
                  .from('customers')
                  .select('associate_id, company_email, personal_email')
                  .in('associate_id', batch);
                
                if (customers) {
                  customers.forEach((customer: any) => {
                    const realEmail = (customer.company_email || customer.personal_email)?.toLowerCase().trim();
                    if (realEmail && customer.associate_id) {
                      fallbackNumericEmails.forEach(numericEmail => {
                        const numericAssocId = parseInt(numericEmail.split('@')[0]);
                        if (numericAssocId === customer.associate_id) {
                          usageStatsNumericToRealEmail.set(numericEmail, realEmail);
                          console.log(`🔄 Usage stats (fallback): Mapping numeric email ${numericEmail} -> ${realEmail}`);
                        }
                      });
                    }
                  });
                }
              }
            }
          }
          
          recentWeekStats.forEach((stat: any) => {
            const email = stat.agent_email?.toLowerCase()?.trim();
            if (!email) return;
            
            // CRITICAL: Replace numeric email with real email if mapping exists
            const realEmail = usageStatsNumericToRealEmail.get(email) || email;
            
            const hasUsage = (Number(stat.vdp_total_minutes) || 0) > 0 || 
                           (Number(stat.total_online_minutes) || 0) > 0 ||
                           (Number(stat.vdp_available_minutes) || 0) > 0 ||
                           (Number(stat.vdp_call_minutes) || 0) > 0;
            
            if (hasUsage) {
              // Add the REAL email, not the numeric email
              allAgentEmails.add(realEmail);
            }
          });
          console.log(`✅ Added ${recentWeekStats.length} agents with usage data from most recent week (${mostRecentWeek})`);
        }
      }
    } catch (usageError) {
      console.error('⚠️ Error fetching usage stats for agent inclusion:', usageError);
    }
    
    console.log(`🔍 After adding agents with connects, missed calls, VDP status, and usage data: ${allAgentEmails.size} total unique agents`);

    const uniqueAgents = Array.from(allAgentEmails);
    console.log(`🔍 Total unique agents: ${uniqueAgents.length}`);

    // Build hierarchy map from agent_profiles (highest priority)
    const isValidName = (name: any): boolean => {
      if (!name) return false;
      const trimmed = String(name).trim();
      return trimmed !== '' && trimmed !== '-' && trimmed.length > 0;
    };
    
    const allHierarchyMap = new Map<string, any>();
    
    // First, add agent_profiles data (highest priority - what agent entered)
    (agentProfilesData || []).forEach(row => {
      if (row.email) {
        const normalized = String(row.email).toLowerCase().trim();
        const mgaTeam = row.mga_team ? String(row.mga_team).trim() : null;
        const rgaTeam = row.rga_team ? String(row.rga_team).trim() : null;
        const agentName = (row.first_name && row.last_name) 
          ? `${String(row.first_name).trim()} ${String(row.last_name).trim()}`.trim()
          : null;
        allHierarchyMap.set(normalized, {
          agent_email: row.email,
          agent_name: agentName,
          agent_associate_id: null,
          mga_name: isValidName(mgaTeam) ? mgaTeam : null,
          rga_name: isValidName(rgaTeam) ? rgaTeam : null,
          mga_associate_id: null,
          rga_associate_id: null,
          source: 'agent_profiles'
        });
        if (normalized.includes('coreytrenk')) {
          console.log(`✅ Found coreytrenk in agent_profiles: MGA=${mgaTeam}, RGA=${rgaTeam}, agent_name=${agentName}`);
        }
      }
    });
    
    // Then, add agent_hierarchy data (fallback, but don't overwrite agent_profiles MGA/RGA)
    (hierarchyAgents || []).forEach(row => {
      if (row.agent_email) {
        const normalized = String(row.agent_email).toLowerCase().trim();
        const existing = allHierarchyMap.get(normalized);
        
        if (existing && existing.source === 'agent_profiles') {
          // Already have from agent_profiles - fill in missing fields only
          if (!existing.agent_name && row.agent_name) existing.agent_name = row.agent_name;
          if (!existing.agent_associate_id && row.agent_associate_id) existing.agent_associate_id = row.agent_associate_id;
          if (!existing.mga_associate_id && row.mga_associate_id) existing.mga_associate_id = row.mga_associate_id;
          if (!existing.rga_associate_id && row.rga_associate_id) existing.rga_associate_id = row.rga_associate_id;
          
          // Fill MGA/RGA from agent_hierarchy if agent_profiles doesn't have it
          if (!isValidName(existing.mga_name) && isValidName(row.mga_name)) {
            existing.mga_name = String(row.mga_name).trim();
          }
          if (!isValidName(existing.rga_name) && isValidName(row.rga_name)) {
            existing.rga_name = String(row.rga_name).trim();
          }
        } else {
          // No agent_profiles data - use agent_hierarchy
          allHierarchyMap.set(normalized, {
            ...row,
            mga_name: isValidName(row.mga_name) ? String(row.mga_name).trim() : null,
            rga_name: isValidName(row.rga_name) ? String(row.rga_name).trim() : null,
            source: 'agent_hierarchy'
          });
        }
      }
    });

    // Apply filters to determine which agents to show
    let filteredAgentEmails: string[] = [];
    
    if (isSysOp && !mgaFilter && !rgaFilter) {
      // SYSOP WITH NO FILTER: Show ALL agents
      filteredAgentEmails = uniqueAgents;
      console.log(`🔍 SYSOP NO FILTER: Showing ALL ${filteredAgentEmails.length} agents`);
    } else {
      filteredAgentEmails = uniqueAgents;
    
      // Apply user's hierarchy filter if NO manual filters are provided AND user is not sysop
    if (!isSysOp && userAssociateId && !mgaFilter && !rgaFilter) {
        const { data: mgaAgents } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email')
        .eq('mga_associate_id', userAssociateId)
        .not('agent_email', 'is', null);
      
        const { data: rgaAgents } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email')
        .eq('rga_associate_id', userAssociateId)
        .not('agent_email', 'is', null);
      
      const allowedEmails = new Set<string>();
      (mgaAgents || []).forEach(a => {
        if (a.agent_email) {
          allowedEmails.add(String(a.agent_email).toLowerCase().trim());
        }
      });
      (rgaAgents || []).forEach(a => {
        if (a.agent_email) {
          allowedEmails.add(String(a.agent_email).toLowerCase().trim());
        }
      });
      
      filteredAgentEmails = uniqueAgents.filter(email => {
          return allowedEmails.has(String(email).toLowerCase().trim());
      });
    }

    // Apply MGA/RGA filters if provided
    if (mgaFilter || rgaFilter) {
      const filterMgaId = mgaFilter ? parseInt(mgaFilter as string) : null;
      const filterRgaId = rgaFilter ? parseInt(rgaFilter as string) : null;
      
      let filteredByHierarchy: string[] = [];
      
      if (filterMgaId && !isNaN(filterMgaId)) {
        if (filterRgaId && !isNaN(filterRgaId)) {
          // Filter by both MGA and RGA
            const { data: filtered } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('agent_email')
            .eq('mga_associate_id', filterMgaId)
            .eq('rga_associate_id', filterRgaId)
            .not('agent_email', 'is', null);
          
            filteredByHierarchy = (filtered || [])
              .map(a => String(a.agent_email || '').toLowerCase().trim())
              .filter(Boolean) as string[];
        } else {
          // Filter by MGA only
            const { data: mgaAgents } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('agent_email')
            .eq('mga_associate_id', filterMgaId)
            .not('agent_email', 'is', null);
          
            filteredByHierarchy = (mgaAgents || [])
              .map(a => String(a.agent_email || '').toLowerCase().trim())
              .filter(Boolean) as string[];
        }
      } else if (filterRgaId && !isNaN(filterRgaId)) {
        // Filter by RGA only
          const { data: rgaAgents } = await supabaseAdmin
          .from('agent_hierarchy')
          .select('agent_email')
          .eq('rga_associate_id', filterRgaId)
          .not('agent_email', 'is', null);
        
          filteredByHierarchy = (rgaAgents || [])
            .map(a => String(a.agent_email || '').toLowerCase().trim())
            .filter(Boolean) as string[];
        }
        
        if (filteredByHierarchy.length > 0) {
          const allowedSet = new Set(filteredByHierarchy);
          filteredAgentEmails = uniqueAgents.filter(email => {
            return allowedSet.has(String(email).toLowerCase().trim());
          });
        } else {
          filteredAgentEmails = [];
        }
      }
    }

    // Ensure Carrington agents are always included
    carringtonAgentsHardcoded.forEach(email => {
      if (!filteredAgentEmails.includes(email)) {
        filteredAgentEmails.push(email);
      }
    });
    
    // CRITICAL: Ensure agents with connects are included even if filtered out
    // This fixes the issue where agents like fayesaad with only connects don't show up
    connectsMap.forEach((count, email) => {
      const normalized = String(email).toLowerCase().trim();
      if (count > 0 && !filteredAgentEmails.includes(normalized)) {
        filteredAgentEmails.push(normalized);
        console.log(`✅ Added agent with connects to filtered list: ${normalized} (${count} connects)`);
      }
    });
    
    // CRITICAL: Ensure agents with missed calls are included even if filtered out
    // This fixes the issue where agents with only missed calls don't show up
    missedCallsMap.forEach((count, email) => {
      const normalized = String(email).toLowerCase().trim();
      if (count > 0 && !filteredAgentEmails.includes(normalized)) {
        filteredAgentEmails.push(normalized);
        console.log(`📞 Added agent with missed calls to filtered list: ${normalized} (${count} missed calls)`);
      }
    });
    
    console.log(`🔍 Final filtered agent emails: ${filteredAgentEmails.length} agents`);

    // CRITICAL: Deduplicate numeric emails BEFORE querying stats
    // First, identify numeric emails and look up their real emails
    const numericEmailToRealEmail = new Map<string, string>();
    const allNumericEmails = filteredAgentEmails.filter(email => {
      const emailPrefix = email.split('@')[0];
      return /^\d+$/.test(emailPrefix) && parseInt(emailPrefix) > 0;
    });
    
    if (allNumericEmails.length > 0) {
      // Extract associate_ids from numeric emails
      const numericAssociateIds = new Set<number>();
      allNumericEmails.forEach(email => {
        const assocId = parseInt(email.split('@')[0]);
        if (!isNaN(assocId)) numericAssociateIds.add(assocId);
      });
      
      // Look up real emails from customers table
      if (numericAssociateIds.size > 0) {
        const assocIdArray = Array.from(numericAssociateIds);
        const batchSize = 100;
        for (let i = 0; i < assocIdArray.length; i += batchSize) {
          const batch = assocIdArray.slice(i, i + batchSize);
          const { data: customers } = await supabaseAdmin
            .from('customers')
            .select('associate_id, company_email, personal_email, first_name, last_name, mga, rga')
            .in('associate_id', batch);
          
          if (customers) {
            customers.forEach((customer: any) => {
              const realEmail = (customer.company_email || customer.personal_email)?.toLowerCase().trim();
              const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
              
              // Map all numeric emails with this associate_id to the real email
              allNumericEmails.forEach(numericEmail => {
                const numericAssocId = parseInt(numericEmail.split('@')[0]);
                if (numericAssocId === customer.associate_id) {
                  // CRITICAL: Always map to real email if it exists, even if it's not in filteredAgentEmails
                  if (realEmail) {
                    numericEmailToRealEmail.set(numericEmail.toLowerCase().trim(), realEmail);
                    console.log(`✅ Mapped numeric email ${numericEmail} (associate_id ${customer.associate_id}) -> ${realEmail}`);
                  }
                  // Store customer data for numeric email
                  if (name || customer.mga || customer.rga || customer.associate_id) {
                    customersNameMap.set(numericEmail.toLowerCase().trim(), {
                      name: name || null,
                      associateId: customer.associate_id,
                      realEmail: realEmail || null
                    });
                    // Store MGA/RGA for numeric emails
                    if (customer.associate_id) {
                      customersMgaRgaMap.set(customer.associate_id, {
                        mga: customer.mga && String(customer.mga).trim() !== '' && String(customer.mga).trim() !== '0' ? String(customer.mga).trim() : null,
                        rga: customer.rga && String(customer.rga).trim() !== '' && String(customer.rga).trim() !== '0' ? String(customer.rga).trim() : null
                      });
                    }
                  }
                }
              });
            });
          }
        }
      }
    }
    
    // Replace numeric emails with real emails in filteredAgentEmails BEFORE querying stats
    // CRITICAL: If a numeric email maps to a real email, use the real email and ensure it's in the list
    const deduplicatedAgentEmails = new Set<string>();
    
    filteredAgentEmails.forEach(email => {
      const normalized = email.toLowerCase().trim();
      const realEmail = numericEmailToRealEmail.get(normalized);
      if (realEmail && realEmail !== normalized) {
        // This is a numeric email with a real email mapping - use the real email
        console.log(`🔄 Replacing numeric email ${normalized} with real email ${realEmail}`);
        deduplicatedAgentEmails.add(realEmail);
      } else if (!numericEmailToRealEmail.has(normalized)) {
        // This is NOT a numeric email that maps to something else - include it
        deduplicatedAgentEmails.add(email);
      } else {
        // This is a numeric email but we already processed it above - skip it
        console.log(`⏭️ Skipping numeric email ${normalized} (already mapped)`);
      }
    });
    
    // Also add any real emails that were mapped but might not be in filteredAgentEmails
    numericEmailToRealEmail.forEach((realEmail) => {
      deduplicatedAgentEmails.add(realEmail);
    });
    
    const deduplicatedAgentEmailsArray = Array.from(deduplicatedAgentEmails);
    
    const removedCount = filteredAgentEmails.length - deduplicatedAgentEmailsArray.length;
    console.log(`🔍 After deduplication: ${deduplicatedAgentEmailsArray.length} unique agents (removed ${removedCount} duplicates)`);
    if (numericEmailToRealEmail.size > 0) {
      console.log(`📊 Mapped ${numericEmailToRealEmail.size} numeric emails to real emails`);
      numericEmailToRealEmail.forEach((real, numeric) => {
        console.log(`   ${numeric} -> ${real}`);
      });
    }

    // Query stats directly from agent_dial_metrics and twilio_call_logs
    // CRITICAL: Query stats for BOTH numeric emails AND their real emails, then merge
    const agentEmailsForStatsSet = new Set<string>();
    deduplicatedAgentEmailsArray.forEach(email => {
      agentEmailsForStatsSet.add(String(email).toLowerCase().trim());
    });
    // Also add numeric emails to stats query so we can merge their stats
    numericEmailToRealEmail.forEach((realEmail, numericEmail) => {
      agentEmailsForStatsSet.add(numericEmail);
      agentEmailsForStatsSet.add(realEmail);
    });
    const agentEmailsForStats = Array.from(agentEmailsForStatsSet);
    
    // Query agent_dial_metrics for stats within date range
    // CRITICAL: Paginate to get ALL records - Supabase defaults to 1000 row limit
    const dialMetricsData: any[] = [];
    let dialMetricsOffset = 0;
    const dialMetricsBatchSize = 1000;
    let hasMoreDialMetrics = true;
    
    while (hasMoreDialMetrics) {
      const { data: dialMetricsBatch, error: dialMetricsError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('agent_email, event_type, lead_phone, disposition')
        .in('agent_email', agentEmailsForStats)
        .gte('event_timestamp', dateStart.toISOString())
        .lt('event_timestamp', dateEnd.toISOString())
        .order('event_timestamp', { ascending: true })
        .range(dialMetricsOffset, dialMetricsOffset + dialMetricsBatchSize - 1);
      
      if (dialMetricsError) {
        console.error('❌ Error fetching agent_dial_metrics:', dialMetricsError);
        hasMoreDialMetrics = false;
        break;
      }
      
      if (dialMetricsBatch && dialMetricsBatch.length > 0) {
        dialMetricsData.push(...dialMetricsBatch);
        dialMetricsOffset += dialMetricsBatchSize;
        
        if (dialMetricsBatch.length < dialMetricsBatchSize) {
          hasMoreDialMetrics = false;
        }
      } else {
        hasMoreDialMetrics = false;
      }
    }
    
    // Query twilio_call_logs for dialed count
    // CRITICAL: Paginate to get ALL calls - Supabase defaults to 1000 row limit
    const twilioCallsData: any[] = [];
    let twilioOffset = 0;
    const twilioBatchSize = 1000;
    let hasMoreTwilio = true;
    
    while (hasMoreTwilio) {
      const { data: twilioBatch, error: twilioError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('owner_email, to_number, call_duration, call_status, call_direction')
        .in('owner_email', agentEmailsForStats)
        .gte('call_started_at', dateStart.toISOString())
        .lt('call_started_at', dateEnd.toISOString())
        .eq('call_direction', 'outbound')
        .not('to_number', 'is', null)
        .neq('to_number', '')
        .order('call_started_at', { ascending: true })
        .range(twilioOffset, twilioOffset + twilioBatchSize - 1);
      
      if (twilioError) {
        console.error('❌ Error fetching twilio_call_logs:', twilioError);
        hasMoreTwilio = false;
        break;
      }
      
      if (twilioBatch && twilioBatch.length > 0) {
        twilioCallsData.push(...twilioBatch);
        twilioOffset += twilioBatchSize;
        
        if (twilioBatch.length < twilioBatchSize) {
          hasMoreTwilio = false;
        }
      } else {
        hasMoreTwilio = false;
      }
    }
    
    // Calculate stats per agent
    const statsMap = new Map<string, any>();
    
    // Initialize all agents with zero stats
    agentEmailsForStats.forEach(email => {
      statsMap.set(email, {
        dialed: 0,
        reached: 0,
        booked: 0,
        instantPresentation: 0,
        presentations: 0,
        sales: 0,
        alp: 0
      });
    });
    
    // Count dialed from twilio_call_logs (distinct phone numbers)
    // CRITICAL: NO duration requirement - count ALL outbound calls
    // Exclude: failed, busy, no-answer, canceled (unless answered/completed)
    const dialedPhones = new Map<string, Set<string>>();
    twilioCallsData.forEach((row: any) => {
      if (row.owner_email && row.to_number) {
        const email = String(row.owner_email).toLowerCase().trim();
        const phone = String(row.to_number).trim();
        const status = String(row.call_status || '').toLowerCase();
        
        // Check if call was answered
        const isAnswered = status === 'answered' || status === 'completed';
        
        // Exclude failed/busy/no-answer/canceled (unless answered)
        const isExcluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !isAnswered;
        
        // NEW FORMULA: Count ALL outbound calls that are NOT excluded (NO duration requirement)
        if (!isExcluded) {
          if (!dialedPhones.has(email)) {
            dialedPhones.set(email, new Set());
          }
          dialedPhones.get(email)!.add(phone);
        }
      }
    });
    
    dialedPhones.forEach((phones, email) => {
      const stats = statsMap.get(email);
      if (stats) {
        stats.dialed = phones.size;
      }
    });
    
    // Count reached, booked, instant_presentation from agent_dial_metrics
    const reachedPhones = new Map<string, Set<string>>();
    const bookedPhones = new Map<string, Set<string>>();
    const instantPresentationPhones = new Map<string, Set<string>>();
    
    dialMetricsData.forEach((row: any) => {
      if (row.agent_email && row.lead_phone) {
        const email = String(row.agent_email).toLowerCase().trim();
        const phone = String(row.lead_phone).trim();
        const eventType = String(row.event_type || '').toLowerCase();
        const disposition = String(row.disposition || '').toLowerCase();
        
        if (eventType === 'reach') {
          if (!reachedPhones.has(email)) {
            reachedPhones.set(email, new Set());
          }
          reachedPhones.get(email)!.add(phone);
        }
        
        if (eventType === 'booked' || eventType === 'instant_presentation' || disposition === 'booked' || disposition === 'instant_presentation') {
          if (!bookedPhones.has(email)) {
            bookedPhones.set(email, new Set());
          }
          bookedPhones.get(email)!.add(phone);
        }
        
        if (eventType === 'instant_presentation' || disposition === 'instant_presentation') {
          if (!instantPresentationPhones.has(email)) {
            instantPresentationPhones.set(email, new Set());
          }
          instantPresentationPhones.get(email)!.add(phone);
        }
      }
    });
    
    reachedPhones.forEach((phones, email) => {
      const stats = statsMap.get(email);
      if (stats) {
        stats.reached = phones.size;
      }
    });
    
    bookedPhones.forEach((phones, email) => {
      const stats = statsMap.get(email);
      if (stats) {
        stats.booked = phones.size;
      }
    });
    
    instantPresentationPhones.forEach((phones, email) => {
      const stats = statsMap.get(email);
      if (stats) {
        stats.instantPresentation = phones.size;
      }
    });

    // Debug: Check if lanebeasley is in filtered list
    const lanebeasleyInFiltered = filteredAgentEmails.find(e => String(e).toLowerCase().trim().includes('lanebeasley'));
    if (lanebeasleyInFiltered) {
      console.log(`🔍 DEBUG: lanebeasley found in filteredAgentEmails: ${lanebeasleyInFiltered}, normalized: ${String(lanebeasleyInFiltered).toLowerCase().trim()}`);
      console.log(`🔍 DEBUG: missedCallsMap has this email? ${missedCallsMap.has(String(lanebeasleyInFiltered).toLowerCase().trim())}`);
      console.log(`🔍 DEBUG: missedCallsMap keys containing lanebeasley:`, Array.from(missedCallsMap.keys()).filter(k => k.includes('lanebeasley')));
    } else {
      console.log(`⚠️ DEBUG: lanebeasley NOT found in filteredAgentEmails (total: ${filteredAgentEmails.length})`);
    }
    
    // Fetch agent names from customers table for agents not in hierarchy
    const customersNameMap = new Map<string, { name: string; associateId: number | null; realEmail: string | null }>();
    const associateIdsToLookup = new Set<number>();
    const emailsNeedingNames = filteredAgentEmails.filter(email => {
      const normalized = String(email).toLowerCase().trim();
      const hierarchyRow = allHierarchyMap.get(normalized);
      return !hierarchyRow?.agent_name; // Only fetch if no name in hierarchy
    });
    
    // CRITICAL: Check ALL filteredAgentEmails for numeric emails (not just emailsNeedingNames)
    // Extract associate_id from numeric emails (e.g., 103021@aoglobelife.com -> 103021)
    const numericEmailAssociateIds = new Map<string, number>();
    filteredAgentEmails.forEach(email => {
      const emailPrefix = email.split('@')[0];
      const possibleAssociateId = parseInt(emailPrefix);
      // Check if email is numeric (all digits before @)
      if (!isNaN(possibleAssociateId) && possibleAssociateId > 0 && /^\d+$/.test(emailPrefix)) {
        numericEmailAssociateIds.set(email.toLowerCase().trim(), possibleAssociateId);
        associateIdsToLookup.add(possibleAssociateId);
      }
    });
    
    // CRITICAL: Look up customers by associate_id for numeric emails FIRST
    const customersMgaRgaMap = new Map<number, { mga: string | null; rga: string | null }>();
    if (numericEmailAssociateIds.size > 0) {
      const associateIdArray = Array.from(new Set(Array.from(numericEmailAssociateIds.values())));
      const batchSize = 100;
      for (let i = 0; i < associateIdArray.length; i += batchSize) {
        const batch = associateIdArray.slice(i, i + batchSize);
        const { data: customersByAssoc } = await supabaseAdmin
          .from('customers')
          .select('associate_id, first_name, last_name, company_email, personal_email, mga, rga')
          .in('associate_id', batch);
        
        if (customersByAssoc) {
          customersByAssoc.forEach((customer: any) => {
            const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            if (name && customer.associate_id) {
              const companyEmail = customer.company_email?.toLowerCase().trim();
              const personalEmail = customer.personal_email?.toLowerCase().trim();
              
              // Store MGA/RGA from customers table
              if (customer.associate_id) {
                customersMgaRgaMap.set(customer.associate_id, {
                  mga: customer.mga && String(customer.mga).trim() !== '' && String(customer.mga).trim() !== '0' ? String(customer.mga).trim() : null,
                  rga: customer.rga && String(customer.rga).trim() !== '' && String(customer.rga).trim() !== '0' ? String(customer.rga).trim() : null
                });
              }
              
              // Map the numeric email to the customer data
              numericEmailAssociateIds.forEach((assocId, numericEmail) => {
                if (assocId === customer.associate_id) {
                  customersNameMap.set(numericEmail, { 
                    name, 
                    associateId: customer.associate_id,
                    realEmail: companyEmail || personalEmail || null
                  });
                }
              });
              
              // Also map the real email if it exists
              if (companyEmail) {
                customersNameMap.set(companyEmail, { name, associateId: customer.associate_id, realEmail: companyEmail });
              }
              if (personalEmail) {
                customersNameMap.set(personalEmail, { name, associateId: customer.associate_id, realEmail: personalEmail });
              }
            }
          });
        }
      }
    }
    
    if (emailsNeedingNames.length > 0) {
      // Fetch in batches to avoid query limits
      const batchSize = 100;
      for (let i = 0; i < emailsNeedingNames.length; i += batchSize) {
        const batch = emailsNeedingNames.slice(i, i + batchSize);
        // Build OR query properly
        const orConditions = batch.flatMap(e => [
          `company_email.eq.${e}`,
          `personal_email.eq.${e}`
        ]);
        
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('company_email, personal_email, first_name, last_name, associate_id, mga, rga')
          .or(orConditions.join(','));
        
        if (customers) {
          customers.forEach((customer: any) => {
            const companyEmail = customer.company_email?.toLowerCase().trim();
            const personalEmail = customer.personal_email?.toLowerCase().trim();
            const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
            
            // Store MGA/RGA from customers table
            if (customer.associate_id) {
              customersMgaRgaMap.set(customer.associate_id, {
                mga: customer.mga && String(customer.mga).trim() !== '' && String(customer.mga).trim() !== '0' ? String(customer.mga).trim() : null,
                rga: customer.rga && String(customer.rga).trim() !== '' && String(customer.rga).trim() !== '0' ? String(customer.rga).trim() : null
              });
            }
            
            if (name) {
              if (companyEmail) {
                customersNameMap.set(companyEmail, { name, associateId: customer.associate_id, realEmail: companyEmail });
                if (customer.associate_id) associateIdsToLookup.add(customer.associate_id);
              }
              if (personalEmail) {
                customersNameMap.set(personalEmail, { name, associateId: customer.associate_id, realEmail: personalEmail });
                if (customer.associate_id) associateIdsToLookup.add(customer.associate_id);
              }
            }
          });
        }
      }
      
    }
    
    // Look up MGA/RGA from agent_hierarchy by associate_id for agents found in customers
    const hierarchyByAssociateId = new Map<number, { mga_name: string | null; rga_name: string | null }>();
    if (associateIdsToLookup.size > 0) {
      const associateIdArray = Array.from(associateIdsToLookup);
      // Fetch in batches
      const batchSize = 100;
      for (let i = 0; i < associateIdArray.length; i += batchSize) {
        const batch = associateIdArray.slice(i, i + batchSize);
        const { data: hierarchyData } = await supabaseAdmin
          .from('agent_hierarchy')
          .select('agent_associate_id, mga_name, rga_name')
          .in('agent_associate_id', batch);
        
        if (hierarchyData) {
          hierarchyData.forEach((row: any) => {
            if (row.agent_associate_id) {
              hierarchyByAssociateId.set(row.agent_associate_id, {
                mga_name: row.mga_name || null,
                rga_name: row.rga_name || null
              });
            }
          });
        }
      }
    }
    
    // CRITICAL: After querying stats, merge stats from numeric emails into real emails
    // This includes both the main numericEmailToRealEmail map AND usageStatsNumericToRealEmail
    const allNumericMappings = new Map<string, string>();
    numericEmailToRealEmail.forEach((real, numeric) => allNumericMappings.set(numeric, real));
    usageStatsNumericToRealEmail.forEach((real, numeric) => allNumericMappings.set(numeric, real));
    
    allNumericMappings.forEach((realEmail, numericEmail) => {
      const normalizedReal = String(realEmail).toLowerCase().trim();
      const normalizedNumeric = String(numericEmail).toLowerCase().trim();
      
      // Merge stats
      const realStats = statsMap.get(normalizedReal) || { dialed: 0, reached: 0, booked: 0, instantPresentation: 0, presentations: 0, sales: 0, alp: 0 };
      const numericStats = statsMap.get(normalizedNumeric) || { dialed: 0, reached: 0, booked: 0, instantPresentation: 0, presentations: 0, sales: 0, alp: 0 };
      statsMap.set(normalizedReal, {
        dialed: Math.max(realStats.dialed, numericStats.dialed),
        reached: Math.max(realStats.reached, numericStats.reached),
        booked: Math.max(realStats.booked, numericStats.booked),
        instantPresentation: Math.max(realStats.instantPresentation, numericStats.instantPresentation),
        presentations: Math.max(realStats.presentations, numericStats.presentations),
        sales: Math.max(realStats.sales, numericStats.sales),
        alp: Math.max(realStats.alp, numericStats.alp)
      });
      
      // Merge connects
      const realConnects = connectsMap.get(normalizedReal) || 0;
      const numericConnects = connectsMap.get(normalizedNumeric) || 0;
      connectsMap.set(normalizedReal, Math.max(realConnects, numericConnects));
      
      // Merge missed calls
      const realMissed = missedCallsMap.get(normalizedReal) || 0;
      const numericMissed = missedCallsMap.get(normalizedNumeric) || 0;
      missedCallsMap.set(normalizedReal, Math.max(realMissed, numericMissed));
    });
    
    // CRITICAL: Also fetch and merge usage stats from weekly_usage_stats, mapping numeric emails to real emails
    const usageStatsMap = new Map<string, { vdpTotalMinutes: number; vdpAvailableMinutes: number; vdpCallMinutes: number; onlineMinutes: number }>();
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      // Query weekly_usage_stats for usage data
      const { data: usageStatsData } = await supabaseAdmin
        .from('weekly_usage_stats')
        .select('agent_email, vdp_total_minutes, vdp_available_minutes, vdp_call_minutes, total_online_minutes')
        .eq('week_start_date', weekStartStr)
        .limit(10000);
      
      if (usageStatsData && usageStatsData.length > 0) {
        usageStatsData.forEach((stat: any) => {
          const email = stat.agent_email?.toLowerCase()?.trim();
          if (!email) return;
          
          // CRITICAL: Map numeric email to real email for usage stats
          const realEmail = usageStatsNumericToRealEmail.get(email) || allNumericMappings.get(email) || email;
          const normalizedReal = String(realEmail).toLowerCase().trim();
          
          // Merge usage stats - use max to avoid double counting
          const existingStats = usageStatsMap.get(normalizedReal);
          const newStats = {
            vdpTotalMinutes: Number(stat.vdp_total_minutes) || 0,
            vdpAvailableMinutes: Number(stat.vdp_available_minutes) || 0,
            vdpCallMinutes: Number(stat.vdp_call_minutes) || 0,
            onlineMinutes: Number(stat.total_online_minutes) || 0
          };
          
          if (existingStats) {
            // Merge - use max to avoid double counting
            usageStatsMap.set(normalizedReal, {
              vdpTotalMinutes: Math.max(existingStats.vdpTotalMinutes, newStats.vdpTotalMinutes),
              vdpAvailableMinutes: Math.max(existingStats.vdpAvailableMinutes, newStats.vdpAvailableMinutes),
              vdpCallMinutes: Math.max(existingStats.vdpCallMinutes, newStats.vdpCallMinutes),
              onlineMinutes: Math.max(existingStats.onlineMinutes, newStats.onlineMinutes)
            });
          } else {
            usageStatsMap.set(normalizedReal, newStats);
          }
        });
      }
    } catch (usageStatsError) {
      console.error('⚠️ Error fetching usage stats for agent data:', usageStatsError);
    }
    
    // Fetch credits from user_credits (no agent filter) for leaderboard display
    const creditsMap = new Map<string, number>();
    try {
      const { data: creditsRows } = await supabaseAdmin
        .from('user_credits')
        .select('email, credits_remaining')
        .limit(10000);
      if (creditsRows) {
        creditsRows.forEach((r: any) => {
          const k = (r.email || '').toString().toLowerCase().trim();
          if (k) creditsMap.set(k, Number(r.credits_remaining) ?? 0);
        });
        console.log(`📊 Credits map built: ${creditsMap.size} entries from user_credits`);
      }
    } catch (creditsErr) {
      console.error('⚠️ Error fetching credits for live call board:', creditsErr);
    }
    
    // Build agent data - use deduplicated list (only real emails, no numeric duplicates)
    const agentData = deduplicatedAgentEmailsArray.map(email => {
        const normalizedEmail = String(email).toLowerCase().trim();
      
      // Get stats - already merged from numeric emails above
      const stats = statsMap.get(normalizedEmail) || {
        dialed: 0, reached: 0, booked: 0, instantPresentation: 0, presentations: 0, sales: 0, alp: 0
      };
      
      // Get hierarchy data and customer data
      const hierarchyRow = allHierarchyMap.get(normalizedEmail);
      const customerData = customersNameMap.get(normalizedEmail);
      
        // Get MGA/RGA: hierarchy first, then lookup by associate_id from customers
        let finalMgaName = (hierarchyRow?.mga_name && isValidName(hierarchyRow.mga_name)) ? String(hierarchyRow.mga_name).trim() : null;
        let finalRgaName = (hierarchyRow?.rga_name && isValidName(hierarchyRow.rga_name)) ? String(hierarchyRow.rga_name).trim() : null;
        
        // If no MGA/RGA from hierarchy, try to look up by associate_id
        let lookupAssociateId = customerData?.associateId;
        if (!lookupAssociateId) {
          // Check if this was mapped from a numeric email
          numericEmailToRealEmail.forEach((realEmail, numericEmail) => {
            if (realEmail === normalizedEmail) {
              const numericAssocId = parseInt(numericEmail.split('@')[0]);
              if (!isNaN(numericAssocId)) {
                lookupAssociateId = numericAssocId;
              }
            }
          });
          // Also check if this IS a numeric email (not mapped to real email)
          if (!lookupAssociateId && /^\d+@/.test(email)) {
            const numericAssocId = parseInt(email.split('@')[0]);
            if (!isNaN(numericAssocId)) {
              lookupAssociateId = numericAssocId;
            }
          }
        }
        if ((!finalMgaName || !finalRgaName) && lookupAssociateId) {
          // First try agent_hierarchy
          const hierarchyByAssoc = hierarchyByAssociateId.get(lookupAssociateId);
          if (hierarchyByAssoc) {
            if (!finalMgaName && hierarchyByAssoc.mga_name && isValidName(hierarchyByAssoc.mga_name)) {
              finalMgaName = String(hierarchyByAssoc.mga_name).trim();
            }
            if (!finalRgaName && hierarchyByAssoc.rga_name && isValidName(hierarchyByAssoc.rga_name)) {
              finalRgaName = String(hierarchyByAssoc.rga_name).trim();
            }
          }
          
          // Then try customers table directly (CRITICAL FIX)
          if ((!finalMgaName || !finalRgaName)) {
            const customersMgaRga = customersMgaRgaMap.get(lookupAssociateId);
            if (customersMgaRga) {
              if (!finalMgaName && customersMgaRga.mga && isValidName(customersMgaRga.mga)) {
                finalMgaName = String(customersMgaRga.mga).trim();
              }
              if (!finalRgaName && customersMgaRga.rga && isValidName(customersMgaRga.rga)) {
                finalRgaName = String(customersMgaRga.rga).trim();
              }
            }
          }
        }
        
        // Get agent name: hierarchy first, then customers table, then fallback
        // Also check if this email came from a numeric email mapping
        let agentName = hierarchyRow?.agent_name || customerData?.name;
        if (!agentName) {
          // Check if this was mapped from a numeric email
          numericEmailToRealEmail.forEach((realEmail, numericEmail) => {
            if (realEmail === normalizedEmail) {
              const numericCustomerData = customersNameMap.get(numericEmail);
              if (numericCustomerData?.name) {
                agentName = numericCustomerData.name;
              }
            }
          });
          if (!agentName) {
            agentName = email.split('@')[0];
          }
        }
        
        // Get associate_id - check numeric mapping too
        let associateId = hierarchyRow?.agent_associate_id?.toString() || customerData?.associateId?.toString();
        if (!associateId) {
          // Check if this was mapped from a numeric email
          numericEmailToRealEmail.forEach((realEmail, numericEmail) => {
            if (realEmail === normalizedEmail) {
              const numericAssocId = parseInt(numericEmail.split('@')[0]);
              if (!isNaN(numericAssocId)) {
                associateId = numericAssocId.toString();
              }
            }
          });
          // Also check if this IS a numeric email (not mapped to real email)
          if (!associateId && /^\d+@/.test(email)) {
            const numericAssocId = parseInt(email.split('@')[0]);
            if (!isNaN(numericAssocId)) {
              associateId = numericAssocId.toString();
            }
          }
        }
        
      if (normalizedEmail.includes('coreytrenk')) {
        console.log(`🔍 DEBUG coreytrenk: MGA=${finalMgaName}, RGA=${finalRgaName}, source=${hierarchyRow?.source}`);
        }
        
        // Use the email as-is (already deduplicated, so this is the real email)
        const displayEmail = email;
        
        return {
          id: displayEmail,
        name: agentName,
          email: displayEmail,
        associateId: associateId,
          mgaName: finalMgaName,
          rgaName: finalRgaName,
          mgaAssociateId: hierarchyRow?.mga_associate_id || null,
          rgaAssociateId: hierarchyRow?.rga_associate_id || null,
        status: 'offline' as const,
        todayStats: stats,
          credits: (() => {
            const n = creditsMap.get(normalizedEmail) ?? creditsMap.get((customerData?.realEmail || '').toLowerCase().trim()) ?? 0;
            return Number(n);
          })(),
          creditsRemaining: (() => {
            const n = creditsMap.get(normalizedEmail) ?? creditsMap.get((customerData?.realEmail || '').toLowerCase().trim()) ?? 0;
            return Number(n);
          })(),
          pendingLeads: 0,
        connects: (() => {
            // Use real email for connects lookup if mapped
            const lookupEmail = customerData?.realEmail || normalizedEmail;
            return connectsMap.get(lookupEmail) || connectsMap.get(normalizedEmail) || 0;
          })(),
        vdpCalls: (() => {
            // Use real email for connects lookup if mapped
            const lookupEmail = customerData?.realEmail || normalizedEmail;
            return connectsMap.get(lookupEmail) || connectsMap.get(normalizedEmail) || 0;
          })(),
          missedCalls: (() => {
            // Use real email for missed calls lookup if mapped
            const lookupEmail = customerData?.realEmail || normalizedEmail;
            const count = missedCallsMap.get(lookupEmail) || missedCallsMap.get(normalizedEmail) || 0;
            // Debug logging for specific agent
            if (normalizedEmail.includes('lanebeasley')) {
              console.log(`🔍 DEBUG lanebeasley missed calls: email=${normalizedEmail}, count=${count}, mapHas=${missedCallsMap.has(normalizedEmail)}, mapKeys=${Array.from(missedCallsMap.keys()).filter(k => k.includes('lanebeasley')).join(',')}`);
            }
            return count;
          })(),
          usageStats: usageStatsMap.get(normalizedEmail) || null,
          lastActivity: new Date(0).toISOString()
      };
    });

    // Sort by production
    agentData.sort((a, b) => {
      const aPoints = (a.todayStats.dialed || 0) * 1 + (a.todayStats.reached || 0) * 25 + 
                     (a.todayStats.booked || 0) * 50 + (a.todayStats.presentations || 0) * 200 + 
                     (a.todayStats.sales || 0) * 800;
      const bPoints = (b.todayStats.dialed || 0) * 1 + (b.todayStats.reached || 0) * 25 + 
                     (b.todayStats.booked || 0) * 50 + (b.todayStats.presentations || 0) * 200 + 
                     (b.todayStats.sales || 0) * 800;
      return bPoints - aPoints;
    });

    res.json({
      agents: agentData,
      total: agentData.length
    });
  } catch (error: any) {
    console.error('❌ Live Call Board agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents', details: error?.message });
  }
});
