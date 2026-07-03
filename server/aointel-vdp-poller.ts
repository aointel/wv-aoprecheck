/**
 * AOIntel VDP Poller
 * Watches vdp_calls table for PICK_UP events and creates AOIntel leads
 * This ensures agents receive inbound AOIntel leads and outbound dialing is paused
 */

import { supabaseAdmin } from './supabase.js';
import { masterleadClient } from './local-masterlead-client.js';

// Import triggerAOIntelLeadDisplay from routes.ts
// We'll need to access it via a shared module or pass it in
let triggerAOIntelLeadDisplay: ((lead: any, agentEmail: string) => Promise<void>) | null = null;

// Function to set the trigger function (called from index.ts after routes are loaded)
export function setAOIntelLeadDisplayTrigger(triggerFn: (lead: any, agentEmail: string) => Promise<void>) {
  triggerAOIntelLeadDisplay = triggerFn;
  console.log('✅ AOIntel lead display trigger function set');
}

interface VDPCallRecord {
  id: number;
  agent: string; // Associate ID
  event: string;
  leadid: string;
  company_email: string;
  phone: string;
  firstName: string;
  lastName: string;
  market: string;
  duration?: number;
  time: string;
  [key: string]: any;
}

class AOIntelVDPPoller {
  private isRunning = false;
  private pollInterval = 2000; // 2 seconds - faster for real-time lead delivery (backup to webhook)
  private processedIds = new Set<number>();
  private lastPollTime: Date | null = null;

  start() {
    if (this.isRunning) {
      console.log('⚠️ AOIntel VDP poller already running');
      return;
    }

    this.isRunning = true;
    console.log('🎯 Starting AOIntel VDP poller - checking vdp_calls table every 5 seconds for PICK_UP events');
    this.poll();
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 AOIntel VDP poller stopped');
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      await this.checkForAOIntelPickups();
    } catch (error) {
      console.error('❌ AOIntel VDP poller error:', error);
    }

    // Schedule next poll
    setTimeout(() => this.poll(), this.pollInterval);
  }

  /**
   * Check if market qualifies as AOIntel (Veteran or Globe Market)
   */
  private isAOIntelMarket(market: string): boolean {
    if (!market) return false;
    const normalizedMarket = market.toLowerCase();
    return normalizedMarket.includes('veteran') || normalizedMarket.includes('globe market');
  }

  private async checkForAOIntelPickups() {
    if (!supabaseAdmin) {
      console.log('⚠️ AOIntel poller: No Supabase connection');
      return;
    }

    try {
      // Get recent PICK_UP events from vdp_calls (last 30 seconds to ensure we catch new ones)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: records, error } = await supabaseAdmin
        .from('vdp_calls')
        .select('*')
        .eq('event', 'PICK_UP')
        .gte('time', thirtySecondsAgo)
        .order('time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error querying vdp_calls for PICK_UP events:', error);
        return;
      }

      if (!records || records.length === 0) {
        // Quiet poll - no new PICK_UP events
        this.lastPollTime = new Date();
        return;
      }

      // Filter for AOIntel markets (Veteran, Globe Market)
      const aoiRecords = records.filter((r: VDPCallRecord) => this.isAOIntelMarket(r.market));

      if (aoiRecords.length === 0) {
        this.lastPollTime = new Date();
        return;
      }

      console.log(`📞 AOIntel PICK_UP: Found ${aoiRecords.length} AOIntel call(s)`);

      // Process each record
      let newRecordsProcessed = 0;
      for (const record of aoiRecords as VDPCallRecord[]) {
        // Skip if already processed
        if (this.processedIds.has(record.id)) {
          continue;
        }

        console.log(`\n🚨 NEW AOINTEL PICK_UP #${record.id}: ${record.firstName} ${record.lastName} (${record.phone}) - Agent: ${record.company_email || record.agent}`);
        
        // Mark as processed immediately to avoid duplicates
        this.processedIds.add(record.id);
        newRecordsProcessed++;

        // Trim the Set if it gets too large
        if (this.processedIds.size > 1000) {
          const idsArray = Array.from(this.processedIds);
          this.processedIds = new Set(idsArray.slice(-500));
        }

        await this.createAOIntelLead(record);
      }
      
      if (newRecordsProcessed > 0) {
        console.log(`\n✅ Processed ${newRecordsProcessed} new AOIntel PICK_UP event(s)`);
      }

      this.lastPollTime = new Date();

    } catch (error) {
      console.error('❌ Error checking for AOIntel PICK_UP events:', error);
    }
  }

  /**
   * Get agent email from associate ID
   */
  private async getAgentEmailFromAssociateId(associateId: string): Promise<string | null> {
    if (!supabaseAdmin || !associateId) return null;

    try {
      const associateIdInt = parseInt(associateId);
      if (isNaN(associateIdInt)) return null;

      // Try user_credits first
      const { data: userCredit } = await supabaseAdmin
        .from('user_credits')
        .select('email')
        .eq('associate_id', associateIdInt)
        .maybeSingle();

      if (userCredit?.email) {
        return userCredit.email.toLowerCase();
      }

      // Try producerlist
      const { data: producer } = await supabaseAdmin
        .from('producerlist')
        .select('company_email')
        .eq('associate_id', associateIdInt)
        .maybeSingle();

      if (producer?.company_email) {
        return producer.company_email.toLowerCase();
      }

      // Try customers
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email')
        .eq('associate_id', associateIdInt)
        .maybeSingle();

      if (customer?.company_email) {
        return customer.company_email.toLowerCase();
      }

      return null;
    } catch (error) {
      console.error('❌ Error looking up agent email:', error);
      return null;
    }
  }

  /**
   * Create AOIntel lead in masterlead table and trigger frontend display
   */
  private async createAOIntelLead(record: VDPCallRecord) {
    if (!supabaseAdmin) return;

    try {
      // Get agent email
      let agentEmail = record.company_email?.toLowerCase();
      if (!agentEmail && record.agent) {
        agentEmail = await this.getAgentEmailFromAssociateId(record.agent) || undefined;
      }

      if (!agentEmail) {
        console.error(`❌ Cannot create AOIntel lead - no agent email found for ${record.agent}`);
        return;
      }

      const now = new Date();
      const leadName = `${record.firstName || ''} ${record.lastName || ''}`.trim() || 'AOIntel Lead';

      // Check if lead already exists
      const { data: existingLead } = await masterleadClient.from('masterlead')
        .select('id, cnresolution')
        .eq('taalk_lead_id', record.leadid)
        .maybeSingle();

      let leadData: any = null;

      if (existingLead) {
        console.log(`ℹ️ AOIntel lead ${record.leadid} already exists with resolution: ${existingLead.cnresolution}`);
        
        // If lead exists but isn't pending/aointel, update it to pending to bring it back to queue
        const resolution = String(existingLead.cnresolution || '').toLowerCase();
        if (resolution !== 'pending' && resolution !== 'aointel') {
          console.log(`🔄 Resetting existing lead ${record.leadid} to pending for new AOIntel call`);
          
          const { data: updatedLead, error: updateError } = await masterleadClient.from('masterlead')
            .update({
              cnresolution: 'pending',
              aointel: true,
              cn_email: agentEmail,
              updated_at: now.toISOString()
            })
            .eq('id', existingLead.id)
            .select()
            .single();

          if (updateError) {
            console.error(`❌ Failed to update existing AOIntel lead:`, updateError);
            return;
          }
          leadData = updatedLead;
        } else {
          // Lead already exists and is pending - fetch full data for WebSocket trigger
          const { data: fullLead } = await masterleadClient.from('masterlead')
            .select('*')
            .eq('id', existingLead.id)
            .single();
          leadData = fullLead;
        }
      } else {
        // Create new lead
        const masterleadPayload = {
          taalk_lead_id: String(record.leadid),
          first_name: record.firstName || null,
          last_name: record.lastName || null,
          phone: record.phone || null,
          taalk_market: record.market || 'AOIntel',
          cn_email: agentEmail,
          cnresolution: 'pending', // Pending requires agent resolution
          aointel: true, // Critical: marks as AOIntel lead
          taalk_lead_source: 'ao_intel_inbound',
          updated_at: now.toISOString()
        };

        const { error: insertError, data: newLead } = await masterleadClient.from('masterlead')
          .insert(masterleadPayload)
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Failed to create AOIntel lead:`, insertError);
          return;
        }

        leadData = newLead;
        console.log(`✅ Created AOIntel lead ${record.leadid} for agent ${agentEmail}`);
      }

      // 1. Update agent status to 'in_call' - this signals frontend to pause outbound dialing
      const { error: statusError } = await supabaseAdmin
        .from('agent_live_call_status')
        .upsert({
          agent_email: agentEmail,
          status: 'in_call', // Signal that agent has incoming AOIntel call
          last_heartbeat_at: now.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'agent_email'
        });

      if (statusError) {
        console.error(`❌ Failed to update agent status:`, statusError);
      } else {
        console.log(`✅ Agent ${agentEmail} marked as 'in_call' - outbound dialer should pause`);
      }

      // 2. Update live_call_boardt to show AOIntel call
      const { error: boardError } = await supabaseAdmin
        .from('live_call_boardt')
        .upsert({
          agent_email: agentEmail,
          status: 'calling',
          current_call: {
            phoneNumber: record.phone,
            clientName: leadName,
            direction: 'inbound',
            callStatus: 'ringing',
            callType: 'AOIntel',
            leadId: record.leadid,
            startedAt: now.toISOString()
          },
          last_activity: now.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'agent_email'
        });

      if (boardError) {
        console.error(`❌ Failed to update live_call_boardt:`, boardError);
      } else {
        console.log(`✅ Live call board updated for AOIntel call: ${leadName}`);
      }

      console.log(`🚨 AOIntel lead ${record.leadid} is now PENDING in queue for ${agentEmail}`);
      console.log(`   -> Agent must resolve this lead before it leaves the queue`);

      // 🚨 CRITICAL: Trigger instant WebSocket display for AOIntel lead
      if (leadData && triggerAOIntelLeadDisplay) {
        try {
          await triggerAOIntelLeadDisplay(leadData, agentEmail);
          console.log(`✅ Triggered instant display for AOIntel lead ${record.leadid}`);
        } catch (triggerError) {
          console.error(`❌ Error triggering AOIntel lead display (non-blocking):`, triggerError);
        }
      } else if (!triggerAOIntelLeadDisplay) {
        console.warn(`⚠️ triggerAOIntelLeadDisplay not set - lead created but not displayed instantly`);
      }

    } catch (error) {
      console.error('❌ Error creating AOIntel lead:', error);
    }
  }
}

// Export singleton instance
export const aoIntelVDPPoller = new AOIntelVDPPoller();

