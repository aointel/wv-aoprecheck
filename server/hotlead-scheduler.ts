import * as cron from 'node-cron';
import { hotleadSyncService } from './hotlead-sync-service';
const JOB_WEBHOOKS_ENABLED = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || '').toLowerCase() === 'true';

function canSendZapierWebhooksFromThisRuntime(): boolean {
  if (String(process.env.ALLOW_NON_PROD_ZAPIER_WEBHOOKS || '').toLowerCase() === 'true') {
    return true;
  }
  const envMarker = `${process.env.RAILWAY_ENVIRONMENT || ''} ${process.env.RAILWAY_ENVIRONMENT_NAME || ''} ${process.env.NODE_ENV || ''}`.toLowerCase();
  const hostMarker = `${process.env.RAILWAY_PUBLIC_DOMAIN || ''} ${process.env.RAILWAY_STATIC_URL || ''} ${process.env.RAILWAY_SERVICE_NAME || ''}`.toLowerCase();
  const hasProdEnv = envMarker.includes('production') || envMarker.includes('prod');
  const hasProdHost = hostMarker.includes('aoirail-production') || hostMarker.includes('production-baa2');
  const hasNonProdHost = hostMarker.includes('staging') || hostMarker.includes('beta') || hostMarker.includes('preview');
  return (hasProdEnv || hasProdHost) && !hasNonProdHost;
}

class HotleadScheduler {
  private syncTask: cron.ScheduledTask | null = null;
  private assignmentTask: cron.ScheduledTask | null = null;

  // Start hotlead sync to monitor 50+ second calls and create new hotleads
  startScheduler(): void {
    console.log('🔥 Starting hotlead scheduler - continuous lead replenishment enabled');
    
    // Manage hotlead assignments from database every 30 minutes  
    this.syncTask = cron.schedule('0,30 * * * *', async () => {
      console.log('🔄 Running scheduled hotlead assignment management...');
      try {
        const result = await hotleadSyncService.syncHotleads('today');
        if (result.success) {
          console.log(`✅ Hotlead assignment management completed`);
        } else {
          console.error('❌ Hotlead assignment management failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Error in scheduled hotlead management:', error);
      }
    });

    // Check for 50+ second calls and trigger webhooks every 5 minutes.
    // Disabled by default so booked/Planet sends have one owner and do not duplicate.
    if (JOB_WEBHOOKS_ENABLED && process.env.HOTLEAD_ZAPIER_WEBHOOK_ENABLED === 'true' && canSendZapierWebhooksFromThisRuntime()) {
      this.assignmentTask = cron.schedule('*/5 * * * *', async () => {
        await this.checkHotleadCallsForWebhook();
      });
    } else {
      console.log('⏭️ Hotlead Zapier webhook sender disabled (job/env/runtime guard)');
    }

    // Poll Taalk for AO Recruit transfer-failed calls every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await hotleadSyncService.syncAoRecruitHotleads();
        if (result.newCount > 0) {
          console.log(`🎯 AO Recruit hotleads: ${result.newCount} new leads found`);
        }
      } catch (e: any) {
        console.error('❌ AO Recruit hotlead sync failed:', e.message);
      }
    });

    // HOTLEAD DETECTION: Check for new assignments every 5 minutes (reduced frequency)
    setInterval(async () => {
      try {
        // Quick check for newly assigned hotleads that agents haven't seen yet
        await this.quickHotleadCheck();
      } catch (error) {
        console.error('❌ Hotlead check failed:', error);
      }
    }, 300000); // Every 5 minutes (reduced from 30 seconds)

    console.log('✅ Hotlead scheduler started - database assignment every 30 minutes, AO Recruit sync hourly');
  }

  private async testApiConnection(): Promise<boolean> {
    try {
      const result = await hotleadSyncService.fetchHotleadsFromTaalk(5, 0);
      return result.success;
    } catch {
      return false;
    }
  }

  // Quick check for newly assigned hotleads (reduced logging)
  private async quickHotleadCheck(): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      if (!supabase) {
        return;
      }

      // Silently check for newly assigned hotleads for all authenticated agents
      // (Reduced logging to prevent volume issues)
    } catch (error) {
      console.error('❌ Error in hotlead check:', error);
    }
  }

  // All sync functions disabled - no real API connection exists
  stopScheduler(): void {
    console.log('🛑 No scheduler to stop - completely disabled');
  }

  getStatus(): { syncRunning: boolean; assignmentRunning: boolean } {
    return { syncRunning: false, assignmentRunning: false };
  }

  async forcSync(): Promise<{ success: boolean; newCount: number; updateCount: number; error?: string }> {
    return await hotleadSyncService.syncHotleads('today');
  }

  // Monitor calls to hotleads and trigger webhook for 50+ second calls
  private async checkHotleadCallsForWebhook(): Promise<void> {
    try {
      const { supabase } = await import('./supabase');
      if (!supabase) return;

      // Get all recent Twilio calls from ConnectNow agents
      const { data: recentCalls } = await supabase
        .from('twilio_call_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .eq('call_status', 'completed')
        .gte('call_duration', 60); // 60+ seconds (FIXED: column is call_duration not duration)

      if (!recentCalls || recentCalls.length === 0) return;

      // Check if any of these calls were to hotlead phone numbers
      for (const call of recentCalls) {
        if (!call.to_number) continue;

        // Clean phone number for comparison
        const cleanToNumber = call.to_number.replace(/\D/g, '');
        
        // Check if this number belongs to a hotlead in masterlead table
        const { data: hotleads } = await supabase
          .from('masterlead')
          .select('*')
          .ilike('phone', `%${cleanToNumber.slice(-10)}%`) // Match last 10 digits
          .limit(1);

        if (hotleads && hotleads.length > 0) {
          const hotlead = hotleads[0];
          
          // Check if webhook already sent for this call
          try {
            const { data: existingWebhook } = await supabase
              .from('hotlead_webhooks')
              .select('id')
              .eq('call_sid', call.twilio_call_sid)
              .limit(1);

            if (existingWebhook && existingWebhook.length > 0) {
              continue; // Webhook already sent
            }
          } catch (webhookCheckError) {
            // Table may not exist, proceed with sending
            console.log('⚠️ Could not check webhook history (table may not exist), proceeding...');
          }

          // Send webhook to Planet ALTIG
          await this.sendHotleadWebhook(call, hotlead);
        }
      }
    } catch (error) {
      console.error('❌ Error checking hotlead calls for webhook:', error);
    }
  }

  private async sendHotleadWebhook(call: any, hotlead: any): Promise<void> {
    try {
      if (!JOB_WEBHOOKS_ENABLED) {
        console.log('⏭️ Hotlead job webhook disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)');
        return;
      }
      if (!canSendZapierWebhooksFromThisRuntime()) {
        console.log('⏭️ Hotlead webhook skipped (non-production runtime)');
        return;
      }
      // Get agent email from owner_email field (populated by callConnectorTracker lookup)
      const agentEmail = call.owner_email || call.agent_identity || 'system@aoglobelife.com';
      
      // Look up associate ID from database
      let associateId = null; // DO NOT USE 999 - must have valid associate ID
      if (agentEmail && agentEmail !== 'system@aoglobelife.com' && agentEmail !== 'unknown@aoglobelife.com') {
        try {
          const { supabase } = await import('./supabase');
          if (supabase) {
            const { data: customer } = await supabase
              .from('customers')
              .select('associate_id')
              .eq('company_email', agentEmail.toLowerCase().trim())
              .single();
            
            if (customer && customer.associate_id) {
              associateId = customer.associate_id.toString();
            }
          }
        } catch (lookupError) {
          console.error(`⚠️ Could not lookup associate_id for ${agentEmail} - WEBHOOK WILL NOT BE SENT`);
        }
      }
      
      // Check if we have a valid associate ID
      if (!associateId) {
        console.error(`❌ Cannot send webhook: No associate_id found for agent ${agentEmail} - LEAD WILL NOT BE SENT`);
        return;
      }

      // 🔥 CRITICAL FIX: Use taalk_lead_id (Planet expects Taalk lead ID, NOT database ID!)
      const leadId = hotlead.taalk_lead_id || hotlead.taalkLeadId || hotlead.id;
      
      if (!leadId) {
        console.error('❌ Cannot send webhook: No lead_id found for hotlead', hotlead);
        return;
      }

      const webhookPayload = {
        lead_id: leadId.toString(), // Must be Taalk lead ID, not database ID
        associate_id: associateId
      };

      console.log(`📤 Auto-sending hotlead webhook for 60+ second call: ${call.twilio_call_sid} (${call.call_duration}s) - Agent: ${agentEmail} → ${hotlead.first_name} ${hotlead.last_name}`);

      // Send to Zapier webhook (Zapier forwards to Planet) - this is what works!
      const webhookResponse = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (webhookResponse.ok) {
        console.log('✅ Hotlead webhook sent successfully for 60+ second call');
        
        // Log the webhook to prevent duplicates (Note: hotlead_webhooks table may not exist yet)
        const { supabase } = await import('./supabase');
        if (supabase) {
          try {
            await supabase
              .from('hotlead_webhooks')
              .insert([{
                call_sid: call.twilio_call_sid,
                hotlead_id: hotlead.id,
                agent_email: agentEmail,
                webhook_payload: webhookPayload,
                webhook_status: 'sent',
                sent_at: new Date().toISOString()
              }]);
          } catch (webhookLogError) {
            console.log('⚠️ Could not log webhook (table may not exist):', webhookLogError.message);
          }
        }
      } else {
        console.error('❌ Hotlead webhook failed:', webhookResponse.status);
      }
    } catch (error) {
      console.error('❌ Error sending hotlead webhook:', error);
    }
  }

  private async processHotleadAssignments(): Promise<void> {
    // Placeholder for future hotlead assignment logic
    // This would handle distributing new hotleads to available agents
  }
}

export const hotleadScheduler = new HotleadScheduler();