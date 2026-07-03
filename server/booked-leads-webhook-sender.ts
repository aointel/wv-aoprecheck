import cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import fetch from 'node-fetch';

const JOB_WEBHOOKS_ENABLED = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || '').toLowerCase() === 'true';

export class BookedLeadsWebhookSender {
  private static instance: BookedLeadsWebhookSender;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private warnedAgents: Map<string, number> = new Map(); // Track when we last warned about an agent

  private constructor() {}

  static getInstance(): BookedLeadsWebhookSender {
    if (!BookedLeadsWebhookSender.instance) {
      BookedLeadsWebhookSender.instance = new BookedLeadsWebhookSender();
    }
    return BookedLeadsWebhookSender.instance;
  }

  start(): void {
    if (!JOB_WEBHOOKS_ENABLED) {
      console.log('⏭️ Booked/long-call job webhook sender disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)');
      return;
    }
    if (this.isRunning) {
      console.log('🔄 Booked leads & call tracker webhook sender already running');
      return;
    }

    // Run every 60 seconds to catch booked leads AND long calls
    setInterval(async () => {
      await this.sendBookedLeads();
      await this.sendLongCalls();
    }, 60000);

    this.isRunning = true;
    console.log('✅ Call Connector Pro webhook sender started - checking every 60 seconds');

    // Run first check after 10 seconds
    setTimeout(() => {
      this.sendBookedLeads();
      this.sendLongCalls();
    }, 10000);
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      console.log('🛑 Booked leads webhook sender stopped');
    }
  }

  // Public method to manually trigger webhook sending (all agents or one agent)
  async triggerSend(): Promise<void> {
    console.log('🚀 MANUAL TRIGGER: Sending booked leads and long calls...');
    await this.sendBookedLeads();
    await this.sendLongCalls();
  }

  /** Trigger send only for one agent's unsent booked leads (e.g. from UI). */
  async triggerSendForAgent(agentEmail: string): Promise<{ sent: number; failed: number }> {
    const normalized = String(agentEmail || '').toLowerCase().trim();
    if (!normalized) return { sent: 0, failed: 0 };
    console.log(`🚀 MANUAL TRIGGER (agent): Sending booked leads for ${normalized}`);
    return this.sendBookedLeads(normalized);
  }

  private async sendBookedLeads(agentEmail?: string): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin client not initialized');
        return { sent, failed };
      }

      // Get all booked leads that haven't been sent to webhook yet
      // Include leads with NULL resolved_at OR resolved_at in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      let query = masterleadClient.from('masterlead')
        .select('id, taalk_lead_id, cn_email, previous_cn_email, first_name, last_name, phone, state, created_at, resolved_at')
        .eq('cnresolution', 'booked')
        .is('webhook_sent_at', null)
        .or(`resolved_at.gte.${thirtyDaysAgo},resolved_at.is.null`)
        .limit(100);
      if (agentEmail) {
        query = query.eq('cn_email', agentEmail);
      }
      const { data: bookedLeads, error } = await query;
      
      if (error) {
        console.error('❌ Error fetching booked leads:', error);
        return { sent, failed };
      }

      if (!bookedLeads || bookedLeads.length === 0) {
        return { sent, failed };
      }

      if (bookedLeads.length > 0 && process.env.NODE_ENV !== 'production') {
        console.log(`🔥 Found ${bookedLeads.length} booked leads to send to webhook`);
      }

      for (const lead of bookedLeads) {
        try {
          // Skip leads with no agent email
          if (!lead.cn_email) {
            console.warn(`⚠️ Skipping lead ${lead.id} - no agent email (cn_email is null)`);
            failed++;
            continue;
          }

          // Get associate_id for the agent
          const { data: agent } = await supabaseAdmin
            .from('customers')
            .select('associate_id')
            .eq('company_email', lead.cn_email.toLowerCase().trim())
            .limit(1)
            .maybeSingle();
          
          if (!agent?.associate_id) {
            // Only warn once per agent per hour to reduce log noise
            const lastWarned = this.warnedAgents.get(lead.cn_email) || 0;
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            if (lastWarned < oneHourAgo) {
              console.warn(`⚠️ No associate_id for ${lead.cn_email} - skipping lead ${lead.taalk_lead_id || lead.id}`);
              this.warnedAgents.set(lead.cn_email, Date.now());
            }
            failed++;
            continue;
          }

          if (!lead.taalk_lead_id) {
            console.warn(`⚠️ No taalk_lead_id for lead ${lead.id} - skipping`);
            failed++;
            continue;
          }

          // Resolve call duration: try cn_email then previous_cn_email (reassigned leads)
          const normalizedPhone = String(lead.phone || '').replace(/\D/g, '').slice(-10);
          let callDuration = 0;
          const emailsToTry = [lead.cn_email, lead.previous_cn_email].map(e => e?.toLowerCase?.()?.trim()).filter(Boolean);
          const uniqueEmails = [...new Set(emailsToTry)];

          if (normalizedPhone.length === 10) {
            for (const ownerEmail of uniqueEmails) {
              const { data: recentCall } = await supabaseAdmin
                .from('twilio_call_logs')
                .select('call_duration')
                .eq('owner_email', ownerEmail)
                .eq('call_direction', 'outbound')
                .or(`to_number.eq.${normalizedPhone},to_number.eq.+1${normalizedPhone}`)
                .order('call_started_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              const d = Number((recentCall as any)?.call_duration || 0);
              if (d > callDuration) callDuration = d;
            }
            for (const agentEm of uniqueEmails) {
              if (callDuration >= 45) break;
              const { data: metricsCall } = await supabaseAdmin
                .from('agent_dial_metrics')
                .select('call_duration')
                .eq('agent_email', agentEm)
                .eq('event_type', 'booked')
                .eq('lead_phone', normalizedPhone)
                .order('event_timestamp', { ascending: false })
                .limit(1)
                .maybeSingle();
              const d = Number((metricsCall as any)?.call_duration || 0);
              if (d > callDuration) callDuration = d;
            }
          }

          // Always send booked leads; log when duration is missing or < 45s
          if (callDuration < 45) {
            console.warn(`⚠️ Sending booked lead ${lead.taalk_lead_id} with duration ${callDuration}s (below 45s threshold)`);
          }

          const payload = {
            lead_id: lead.taalk_lead_id.toString(),
            associate_id: agent.associate_id
          };

          // Only log in dev mode to reduce noise
          if (process.env.NODE_ENV !== 'production') {
            console.log(`📤 Sending booked lead: ${lead.first_name} ${lead.last_name} | lead_id=${lead.taalk_lead_id} | duration=${callDuration}s`);
          }

          const { data: claimedRows, error: claimError } = await masterleadClient
            .from('masterlead')
            .update({ webhook_sent_at: new Date().toISOString() })
            .eq('id', lead.id)
            .is('webhook_sent_at', null)
            .select('id');

          if (claimError) {
            console.error(`❌ Failed to claim webhook send for lead ${lead.taalk_lead_id}: ${claimError.message}`);
            failed++;
            continue;
          }
          if (!claimedRows || claimedRows.length === 0) {
            continue;
          }

          const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            sent++;
          } else {
            await masterleadClient.from('masterlead')
              .update({ webhook_sent_at: null })
              .eq('id', lead.id);
            console.error(`❌ Webhook failed for lead ${lead.taalk_lead_id}: ${response.status}`);
            failed++;
          }
        } catch (err: any) {
          console.error(`❌ Error sending webhook for lead ${lead.id}:`, err.message);
          failed++;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (sent > 0 || failed > 0) {
        // Only log summary if there was activity
        if ((sent > 0 || failed > 0) && process.env.NODE_ENV !== 'production') {
        console.log(`📊 Booked leads webhook: ${sent} sent, ${failed} failed`);
        }
      }
    } catch (error: any) {
      console.error('❌ Booked leads webhook sender error:', error.message);
    }
  }

  private async sendLongCalls(): Promise<void> {
    try {
      if (!supabaseAdmin) return;

      // Get calls from last 7 days over 60 seconds that haven't been sent to webhook
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: longCalls, error } = await supabaseAdmin
        .from('call_connector_tracker')
        .select('id, lead_id, agent_email, duration, created_at')
        .gte('created_at', sevenDaysAgo)
        .gte('duration', 60)
        .is('webhook_sent_at', null)
        .limit(50);
      
      if (error || !longCalls || longCalls.length === 0) {
        return;
      }

      console.log(`📞 Found ${longCalls.length} calls over 60 seconds to send to webhook`);

      let sent = 0;

      for (const call of longCalls) {
        try {
          // Get lead info and associate_id
          const { data: lead } = await masterleadClient.from('masterlead')
            .select('taalk_lead_id, cn_email')
            .eq('id', call.lead_id)
            .single();
          
          if (!lead?.taalk_lead_id) continue;

          const { data: agent } = await supabaseAdmin
            .from('customers')
            .select('associate_id')
            .eq('company_email', (call.agent_email || lead.cn_email)?.toLowerCase().trim())
            .single();
          
          if (!agent?.associate_id) continue;

          const payload = {
            lead_id: lead.taalk_lead_id.toString(),
            associate_id: agent.associate_id
          };

          const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await supabaseAdmin
              .from('call_connector_tracker')
              .update({ webhook_sent_at: new Date().toISOString() })
              .eq('id', call.id);
            
            console.log(`✅ Long call webhook sent: lead=${lead.taalk_lead_id} duration=${call.duration}s`);
            sent++;
          }
        } catch (err: any) {
          console.error(`❌ Error sending long call webhook:`, err.message);
        }
      }

      if (sent > 0) {
        console.log(`📊 Long calls: ${sent} webhooks sent`);
      }
    } catch (error: any) {
      console.error('❌ Long calls webhook error:', error.message);
    }
  }
}

export const bookedLeadsWebhookSender = BookedLeadsWebhookSender.getInstance();

