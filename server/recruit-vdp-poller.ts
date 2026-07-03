import { supabaseAdmin } from './supabase';
import { WHEREBY_API_KEY } from './hardcoded-config';

interface BlastPickUpRecord {
  id: number;
  market: string;
  agent: string; // Associate ID
  firstName: string;
  lastName: string;
  phone: string;
  event: string;
  time: string;
  sessionid: string;
  [key: string]: any;
}

interface RecruitPollCandidate extends BlastPickUpRecord {
  interactionKey: string;
  sourceType: 'blast_no_pickup' | 'taalk_no_transfer';
  eligibilityReason: string;
}

interface VdpCallRow {
  id?: number;
  event?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  leadid?: string;
  market?: string;
  agent?: string;
  duration?: number | string | null;
  time?: string;
  mga?: string | null;
  rga?: string | null;
}

class RecruitVDPPoller {
  private isRunning = false;
  private pollInterval = 10000; // 10 seconds
  private processedIds = new Set<number>();
  private processedInteractionKeys = new Set<string>();
  private lastPollTime: Date | null = null;

  start() {
    if (this.isRunning) {
      console.log('⚠️ Recruit VDP poller already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Starting Recruit VDP poller - checking vdp_calls_BLASTPICK table every 10 seconds');
    this.poll();
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Recruit VDP poller stopped');
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      await this.checkForNewRecruitCalls();
    } catch (error) {
      console.error('❌ Recruit VDP poller error:', error);
    }

    // Schedule next poll
    setTimeout(() => this.poll(), this.pollInterval);
  }

  private async checkForNewRecruitCalls() {
    try {
      console.log(`🔍 Polling recruit interactions (BLAST + Taalk no-transfer rules)...`);

      // Pull a wider window so we can detect BLASTER sequences with no PICK_UP.
      const { data: blastRows, error: blastError } = await supabaseAdmin
        .from('vdp_calls_BLASTPICK')
        .select('*')
        .ilike('market', '%aorecruit%')
        .order('time', { ascending: false })
        .limit(300);

      if (blastError) {
        console.error('❌ Error querying vdp_calls_BLASTPICK:', blastError);
        return;
      }

      const blastRecords = (blastRows || []) as BlastPickUpRecord[];
      const transferLikeEvents = new Set(['PICK_UP', 'PICKED', 'TRANSFER', 'CONNECT']);
      const pickupEvents = blastRecords.filter((r) => transferLikeEvents.has(String(r.event || '').toUpperCase()));
      const pickupTimesByPhone = new Map<string, Date[]>();
      for (const pickup of pickupEvents) {
        const phone = this.normalizePhone(pickup.phone);
        const pickupTime = this.parseTimestamp(pickup.time);
        if (!phone || !pickupTime) continue;
        const list = pickupTimesByPhone.get(phone) || [];
        list.push(pickupTime);
        pickupTimesByPhone.set(phone, list);
      }

      const candidateQueue: RecruitPollCandidate[] = [];

      // Rule 1: BLASTER with no transfer-like event for the same session/phone means never transferred.
      const sessions = new Map<string, { hasPickup: boolean; latestBlaster?: BlastPickUpRecord }>();
      for (const row of blastRecords) {
        const eventName = String(row.event || '').toUpperCase();
        const phone = this.normalizePhone(row.phone);
        const sessionKey = String(row.sessionid || row.leadid || `${phone}:${row.agent || 'unknown'}`).trim();
        if (!sessionKey) continue;

        const bucket = sessions.get(sessionKey) || { hasPickup: false };
        if (transferLikeEvents.has(eventName)) {
          bucket.hasPickup = true;
        }
        if (eventName === 'BLASTER' && !bucket.latestBlaster) {
          bucket.latestBlaster = row;
        }
        sessions.set(sessionKey, bucket);
      }

      for (const [sessionKey, bucket] of sessions.entries()) {
        if (!bucket.hasPickup && bucket.latestBlaster) {
          candidateQueue.push({
            ...bucket.latestBlaster,
            interactionKey: `blast-no-pickup:${sessionKey}`,
            sourceType: 'blast_no_pickup',
            eligibilityReason: 'BLASTER sequence had no PICK_UP (never transferred)',
          });
        }
      }

      // Rule 2: Taalk recruit END>=60s with no transfer match is eligible.
      const { data: vdpRows, error: vdpError } = await supabaseAdmin
        .from('vdp_calls')
        .select('id,event,phone,firstName,lastName,leadid,market,agent,duration,time,mga,rga')
        .ilike('market', '%aorecruit%')
        .in('event', ['END', 'end'])
        .gte('duration', 60)
        .order('time', { ascending: false })
        .limit(200);

      if (vdpError) {
        console.warn('⚠️ Failed to query vdp_calls for recruit no-transfer detection:', vdpError.message);
      } else {
        for (const row of (vdpRows || []) as VdpCallRow[]) {
          const phone = this.normalizePhone(row.phone || '');
          const endedAt = this.parseTimestamp(row.time || '');
          if (!phone || !endedAt) continue;

          if (this.hasMatchingPickupWithinWindow(phone, endedAt, pickupTimesByPhone, 10 * 60 * 1000)) {
            continue;
          }

          const interactionKey = `taalk-no-transfer:${row.id || `${phone}:${row.time || ''}`}`;
          candidateQueue.push({
            id: Number(row.id || 0),
            market: row.market || 'aorecruit',
            agent: String(row.agent || ''),
            firstName: String(row.firstName || 'Unknown'),
            lastName: String(row.lastName || ''),
            phone: row.phone || '',
            event: String(row.event || 'END'),
            time: row.time || new Date().toISOString(),
            sessionid: String(row.leadid || row.id || `${phone}-${Date.now()}`),
            leadid: row.leadid || null,
            duration: row.duration || null,
            mga: row.mga || null,
            rga: row.rga || null,
            interactionKey,
            sourceType: 'taalk_no_transfer',
            eligibilityReason: 'Taalk END >=60s with no PICK_UP transfer match',
          });
        }
      }

      if (candidateQueue.length === 0) {
        console.log(`ℹ️ No eligible recruit no-transfer interactions found this cycle`);
        this.lastPollTime = new Date();
        return;
      }

      console.log(`📞 Found ${candidateQueue.length} eligible recruit interactions this cycle`);
      console.log(`📊 Already processed IDs: ${this.processedIds.size}, keys: ${this.processedInteractionKeys.size}`);

      let newRecordsProcessed = 0;
      for (const record of candidateQueue) {
        if (this.processedInteractionKeys.has(record.interactionKey)) {
          continue;
        }
        if (record.id > 0 && this.processedIds.has(record.id)) {
          continue;
        }

        console.log(`\n🆕 ${record.sourceType} [${record.interactionKey}] ${record.firstName} ${record.lastName} (${record.phone}) - Agent: ${record.agent}`);
        console.log(`   ↳ Eligibility: ${record.eligibilityReason}`);

        this.processedInteractionKeys.add(record.interactionKey);
        if (record.id > 0) {
          this.processedIds.add(record.id);
        }
        newRecordsProcessed++;

        if (this.processedIds.size > 1000) {
          const idsArray = Array.from(this.processedIds);
          this.processedIds = new Set(idsArray.slice(-500));
        }
        if (this.processedInteractionKeys.size > 4000) {
          const keysArray = Array.from(this.processedInteractionKeys);
          this.processedInteractionKeys = new Set(keysArray.slice(-2000));
        }

        try {
          await this.createRecruitConnection(record, record.eligibilityReason);
        } catch (error) {
          console.error(`❌ Error processing interaction ${record.interactionKey}:`, error);
        }
      }

      if (newRecordsProcessed === 0) {
        console.log(`✅ No new recruit interactions to process (all already processed)`);
      } else {
        console.log(`\n✅ Processed ${newRecordsProcessed} new recruit interactions`);
      }

      this.lastPollTime = new Date();

    } catch (error) {
      console.error('❌ Error checking for recruit calls:', error);
    }
  }

  private async getAgentEmailFromAssociateId(associateId: string): Promise<string | null> {
    try {
      console.log(`🔍 Looking up email for associate ID: ${associateId}`);
      
      // HARDCODED: Taylor Ermis
      if (associateId === '2233111') {
        console.log(`✅ HARDCODED: Associate ID 2233111 = taylorermis@aoglobelife.com`);
        return 'taylorermis@aoglobelife.com';
      }
      
      // Convert to integer for database lookup
      const associateIdInt = parseInt(associateId);
      if (isNaN(associateIdInt)) {
        console.log(`⚠️ Invalid associate ID (not a number): ${associateId}`);
        return null;
      }
      
      console.log(`🔍 Parsed associate ID as integer: ${associateIdInt}`);
      
      // Try producerlist table - columns are lowercase with underscores
      const { data: producer, error: producerError } = await supabaseAdmin
        .from('producerlist')
        .select('company_email, associate_id')
        .eq('associate_id', associateIdInt)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      console.log(`🔍 producerlist query result for associate_id ${associateIdInt}:`, { 
        found: !!producer, 
        email: producer?.company_email,
        error: producerError?.code 
      });

      if (producer?.company_email) {
        console.log(`✅ Found email in producerlist: ${producer.company_email} for associate_id ${producer.associate_id}`);
        return producer.company_email;
      }

      if (producerError && producerError.code !== 'PGRST116') {
        console.log(`⚠️ producerlist lookup error (code: ${producerError.code}):`, producerError.message);
      }

      // Try agent_hierarchy (used by live call board and many lookups)
      const { data: hierarchyRow } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email, agent_name, agent_associate_id')
        .eq('agent_associate_id', associateIdInt)
        .limit(1)
        .maybeSingle();
      if (!hierarchyRow?.agent_email) {
        const { data: hierarchyByStr } = await supabaseAdmin
          .from('agent_hierarchy')
          .select('agent_email')
          .eq('agent_associate_id', associateId)
          .limit(1)
          .maybeSingle();
        if (hierarchyByStr?.agent_email) {
          console.log(`✅ Found email in agent_hierarchy: ${hierarchyByStr.agent_email} for agent_associate_id ${associateId}`);
          return hierarchyByStr.agent_email;
        }
      } else {
        console.log(`✅ Found email in agent_hierarchy: ${hierarchyRow.agent_email} for agent_associate_id ${associateId}`);
        return hierarchyRow.agent_email;
      }

      // Try agent_profiles table - check if it has associate_id or agent_id column
      // Some profiles might have associate_id stored differently
      const { data: agentProfile } = await supabaseAdmin
        .from('agent_profiles')
        .select('email, agent_id')
        .eq('agent_id', associateId)
        .maybeSingle();

      if (agentProfile?.email) {
        console.log(`✅ Found email in agent_profiles: ${agentProfile.email} for agent_id ${associateId}`);
        return agentProfile.email;
      }

      // Try customers table as last resort
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id')
        .eq('associate_id', associateIdInt)
        .maybeSingle();

      if (customer?.company_email) {
        console.log(`✅ Found email in customers: ${customer.company_email} for associate_id ${associateIdInt}`);
        return customer.company_email;
      }

      if (customer?.personal_email) {
        console.log(`✅ Found email in customers: ${customer.personal_email} for associate_id ${associateIdInt}`);
        return customer.personal_email;
      }

      console.log(`⚠️ Could not find email for associate ID ${associateId} (${associateIdInt}) in producerlist, agent_profiles, or customers`);
      return null;
    } catch (error) {
      console.error(`❌ Error looking up email for associate ID ${associateId}:`, error);
      return null;
    }
  }

  private normalizePhone(phone: string): string {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  private parseTimestamp(value: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private hasMatchingPickupWithinWindow(
    normalizedPhone: string,
    callTime: Date,
    pickupTimesByPhone: Map<string, Date[]>,
    windowMs: number,
  ): boolean {
    const pickupTimes = pickupTimesByPhone.get(normalizedPhone) || [];
    for (const pickupTime of pickupTimes) {
      const delta = Math.abs(callTime.getTime() - pickupTime.getTime());
      if (delta <= windowMs) return true;
    }
    return false;
  }

  private async createRecruitConnection(record: BlastPickUpRecord, eligibilityReason = 'Recruit interaction') {
    try {
      // Get agent email from associate ID
      const agentEmail = await this.getAgentEmailFromAssociateId(record.agent);
      const candidateName = `${record.firstName} ${record.lastName}` || 'Unknown Candidate';
      const candidatePhone = record.phone;

      if (!agentEmail) {
        // Use fallback email - this is expected for invalid/test associate IDs
        // Only log once per unique associate ID to reduce log spam
        // Don't log as error since we handle it gracefully
      }

      // Use fallback email if agent email not found
      const finalAgentEmail = agentEmail || `unknown-agent-${record.agent}@aoglobelife.com`;
      
      console.log(`✅ Agent email: ${finalAgentEmail} for associate ID ${record.agent} ${!agentEmail ? '(FALLBACK)' : ''}`);
      console.log(`🎯 Processing recruit call: ${candidateName} (${candidatePhone}) → ${finalAgentEmail} (agent ID: ${record.agent})`);

      // CRITICAL: Find matching candidate in recruit_candidates table by phone
      const { data: candidate, error: candidateError } = await supabaseAdmin
        .from('recruit_candidates')
        .select('*')
        .eq('phone', candidatePhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (candidateError && candidateError.code !== 'PGRST116') {
        console.error('❌ Error looking up candidate:', candidateError);
      }

      if (!candidate) {
        console.log(`⚠️ No matching candidate found in recruit_candidates for phone: ${candidatePhone}`);
        console.log('📋 Will create connection without candidate_id');
      } else {
        console.log(`✅ Found matching candidate: ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.id})`);
        if (candidate.ai_summary) {
          console.log(`🤖 Candidate has AI summary: ${candidate.ai_summary.substring(0, 100)}...`);
        }
      }

      // Create candidate if doesn't exist OR update existing candidate with AI summary if missing
      if (candidate) {
        console.log(`✅ Found existing candidate: ${candidate.first_name} ${candidate.last_name} (ID: ${candidate.id})`);
        console.log(`📱 Agent ${agentEmail} can view this candidate in their AO Recruit dashboard`);
        
        // If candidate exists but doesn't have AI summary, fetch it from Taalk API
        if (!candidate.ai_summary && record.sessionid) {
          console.log(`🤖 Candidate missing AI summary, fetching from Taalk API for session: ${record.sessionid}`);
          try {
            const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
            const summaryUrl = `https://api.taalk.ai/api/calls/${record.sessionid}/summary?db=michaelmandella`;
            const summaryResponse = await fetch(summaryUrl, {
              headers: { 'Authorization': `Bearer ${taalkApiKey}` }
            });
            
            if (summaryResponse.ok) {
              const summaryJson = await summaryResponse.json();
              const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;
              
              // Only process if we have actual summary data (not empty/null/undefined)
              if (fetchedSummary && fetchedSummary !== null && fetchedSummary !== undefined) {
                let aiSummaryData: string | null = null;
                if (Array.isArray(fetchedSummary)) {
                  // Only store if array has actual content (not empty)
                  if (fetchedSummary.length > 0) {
                    aiSummaryData = JSON.stringify(fetchedSummary);
                  }
                } else if (typeof fetchedSummary === 'string') {
                  // Only store if string has actual content (not empty/whitespace)
                  if (fetchedSummary.trim().length > 0) {
                    aiSummaryData = fetchedSummary;
                  }
                } else if (typeof fetchedSummary === 'object') {
                  // Only store if object has actual content (not empty)
                  const keys = Object.keys(fetchedSummary);
                  if (keys.length > 0) {
                    aiSummaryData = JSON.stringify(fetchedSummary);
                  }
                }
                
                if (aiSummaryData && aiSummaryData !== '[]' && aiSummaryData.trim().length > 0) {
                  console.log(`✅ AI Summary fetched from Taalk API (${aiSummaryData.length} chars)`);
                  
                  // Update candidate with AI summary
                  const { error: updateError } = await supabaseAdmin
                    .from('recruit_candidates')
                    .update({ 
                      ai_summary: aiSummaryData,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', candidate.id);
                  
                  if (updateError) {
                    console.error(`❌ Failed to update candidate with AI summary:`, updateError);
                  } else {
                    console.log(`✅ ✅ ✅ AI SUMMARY SAVED to existing candidate ${candidate.id}!`);
                  }
                } else {
                  console.log(`⚠️ AI Summary is empty or invalid - not storing for candidate ${candidate.id}`);
                }
              } else {
                console.log(`⚠️ Taalk API returned empty/null summary for session ${record.sessionid} - summary may not be ready yet`);
              }
            } else {
              console.log(`⚠️ Taalk API returned ${summaryResponse.status} for session ${record.sessionid} - summary may not be ready yet`);
            }
          } catch (error) {
            console.error(`❌ Error fetching AI summary from Taalk API:`, error);
          }
        } else if (candidate.ai_summary) {
          console.log(`🤖 AI Summary already available: ${candidate.ai_summary.substring(0, 100)}...`);
        }
      } else {
        // AUTO-CREATE NEW CANDIDATE
        console.log(`🆕 Creating new candidate: ${candidateName} (${candidatePhone})`);
        
        // Fetch AI summary from Taalk API using sessionid
        let aiSummaryData: string | null = null;
        if (record.sessionid) {
          console.log(`🤖 Fetching AI summary from Taalk API for session: ${record.sessionid}`);
          try {
            const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
            const summaryUrl = `https://api.taalk.ai/api/calls/${record.sessionid}/summary?db=michaelmandella`;
            const summaryResponse = await fetch(summaryUrl, {
              headers: { 'Authorization': `Bearer ${taalkApiKey}` }
            });
            
            if (summaryResponse.ok) {
              const summaryJson = await summaryResponse.json();
              const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;
              
              // Only process if we have actual summary data (not empty/null/undefined)
              if (fetchedSummary && fetchedSummary !== null && fetchedSummary !== undefined) {
                // Convert to string format (same as webhook)
                if (Array.isArray(fetchedSummary)) {
                  // Only store if array has actual content (not empty)
                  if (fetchedSummary.length > 0) {
                    aiSummaryData = JSON.stringify(fetchedSummary);
                  }
                } else if (typeof fetchedSummary === 'string') {
                  // Only store if string has actual content (not empty/whitespace)
                  if (fetchedSummary.trim().length > 0) {
                    aiSummaryData = fetchedSummary;
                  }
                } else if (typeof fetchedSummary === 'object') {
                  // Only store if object has actual content (not empty)
                  const keys = Object.keys(fetchedSummary);
                  if (keys.length > 0) {
                    aiSummaryData = JSON.stringify(fetchedSummary);
                  }
                }
                
                if (aiSummaryData && aiSummaryData !== '[]' && aiSummaryData.trim().length > 0) {
                  console.log(`✅ AI Summary fetched from Taalk API (${aiSummaryData.length} chars)`);
                } else {
                  console.log(`⚠️ AI Summary is empty or invalid - not storing for new candidate`);
                }
              } else {
                console.log(`⚠️ Taalk API returned empty/null summary for session ${record.sessionid} - summary may not be ready yet`);
              }
            } else {
              console.log(`⚠️ Taalk API returned ${summaryResponse.status} for session ${record.sessionid}`);
            }
          } catch (error) {
            console.error(`❌ Error fetching AI summary from Taalk API:`, error);
          }
        } else {
          console.log(`⚠️ No sessionid available to fetch AI summary`);
        }
        
        const newCandidateData = {
          first_name: record.firstName || 'Unknown',
          last_name: record.lastName || 'Candidate',
          phone: candidatePhone,
          email: '', // VDP doesn't provide email
          status: 'contacted',
          agent_id: record.agent,
          agent_email: finalAgentEmail, // Use fallback if needed
          ai_summary: aiSummaryData, // Include AI summary if fetched
          notes: `Auto-created from recruit interaction (${eligibilityReason}). Agent: ${finalAgentEmail} (ID: ${record.agent}), Market: ${record.market || 'Unknown'}, Session: ${record.sessionid}`,
          created_at: record.time || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const { data: newCandidate, error: createError } = await supabaseAdmin
          .from('recruit_candidates')
          .insert(newCandidateData)
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Failed to create candidate:', createError);
          throw createError;
        } else {
          console.log(`✅ ✅ ✅ CANDIDATE CREATED SUCCESSFULLY! ID: ${newCandidate.id}`);
          if (aiSummaryData) {
            console.log(`🤖 AI Summary included in candidate creation (${aiSummaryData.length} chars)`);
          }
          console.log(`📱 Agent ${finalAgentEmail} can now see "${candidateName}" in their AO Recruit dashboard`);
          console.log(`🔗 Phone: ${candidatePhone}, Status: ${newCandidate.status}, Created: ${newCandidate.created_at}`);
        }
      }

    } catch (error) {
      console.error('❌ Error creating recruit connection:', error);
      console.error('❌ Full error details:', JSON.stringify(error, null, 2));
      // DON'T throw - just log and continue to next record
    }
  }
}

// Export singleton instance
export const recruitVDPPoller = new RecruitVDPPoller();

