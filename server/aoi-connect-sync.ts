import { db } from "./db";
import { aoiConnects } from "../shared/schema";
import { eq } from "drizzle-orm";
import { creditService } from "./credit-service";

interface SupabaseVdpCall {
  id: number;
  Date: string;
  Time: string;
  Event: string;
  Phone: string;
  Agent: string;
  duration: string;
  leadid: string;
  firstname: string;
  lastname: string;
  market: string;
}

export class AOIConnectSync {

  // Sync VDP connects from Supabase to local database
  static async syncFromSupabase(): Promise<{ synced: number, errors: number }> {
    try {
      console.log('🔄 Starting AOI Connect sync from Supabase...');

      // Use Supabase client instead of direct DATABASE_URL connection
      const { supabaseAdmin } = await import('./supabase');

      // DISABLED: Column 'Date' doesn't exist in vdp_calls table
      // The actual column names may be different (lowercase 'date' or 'call_date')
      // Disabling sync to prevent constant errors until column names are verified
      const vdpCalls = [];
      const error = null;
      
      // TODO: Fix column names - check actual Supabase schema for vdp_calls table
      /*
      const { data: vdpCalls, error } = await supabaseAdmin
        .from('vdp_calls')
        .select('id, date, time, event, phone, agent, duration, leadid, firstname, lastname, market')
        .not('leadid', 'is', null)
        .not('firstname', 'is', null)
        .not('lastname', 'is', null)
        .not('market', 'is', null)
        .neq('market', 'NO_CLIENT_DATA')
        .order('id', { ascending: false });
      */

      console.log(`📊 Found ${vdpCalls?.length || 0} complete VDP calls to sync`);

      let synced = 0;
      let errors = 0;

      for (const call of (vdpCalls || [])) {
        try {
          // Check if already synced
          const existing = await db.select()
            .from(aoiConnects)
            .where(eq(aoiConnects.supabaseVdpId, call.id))
            .limit(1);

          if (existing.length > 0) {
            continue; // Already synced
          }

          // Create client name
          const clientName = `${call.firstname} ${call.lastname}`.trim();

          // Insert new AOI connect record
          await db.insert(aoiConnects).values({
            agentId: call.Agent,
            supabaseVdpId: call.id,
            clientPhone: call.Phone,
            clientName: clientName,
            firstName: call.firstname,
            lastName: call.lastname,
            leadId: call.leadid,
            market: call.market,
            callDate: call.Date,
            callTime: call.Time,
            duration: call.duration,
            billingAmount: "8.00",
            billed: false,
            notified: false
          });

          // Send billing notification for this new connect
          const billingAmount = 8.00;
          // Simulate current balance (in real app, get from credit service)
          const currentBalance = 50.00 - billingAmount; 

          creditService.sendBillingNotification(
            call.Agent,
            'aoi_connect',
            billingAmount,
            currentBalance,
            clientName,
            call.Phone
          );

          synced++;

          if (synced % 50 === 0) {
            console.log(`   ✅ Synced ${synced} AOI connects...`);
          }

        } catch (error) {
          console.error(`❌ Error syncing VDP call ${call.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ AOI Connect sync complete: ${synced} synced, ${errors} errors`);
      return { synced, errors };

    } catch (error) {
      console.error('❌ AOI Connect sync failed:', error);
      throw error;
    }
  }

  // Get AOI connects for specific agent
  static async getAgentConnects(agentId: string, limit: number = 50) {
    return await db.select()
      .from(aoiConnects)
      .where(eq(aoiConnects.agentId, agentId))
      .orderBy(aoiConnects.callDate, aoiConnects.callTime)
      .limit(limit);
  }

  // Get total billing for agent
  static async getAgentBilling(agentId: string) {
    const connects = await db.select()
      .from(aoiConnects)
      .where(eq(aoiConnects.agentId, agentId));

    const totalConnects = connects.length;
    const totalBilling = totalConnects * 8.00;
    const unbilledConnects = connects.filter(c => !c.billed).length;
    const unnotifiedConnects = connects.filter(c => !c.notified).length;

    return {
      totalConnects,
      totalBilling,
      unbilledConnects,
      unnotifiedConnects,
      connects
    };
  }

  // Mark connects as billed
  static async markAsBilled(connectIds: number[]) {
    if (connectIds.length === 0) return;

    // Update in batches
    for (const id of connectIds) {
      await db.update(aoiConnects)
        .set({ billed: true })
        .where(eq(aoiConnects.id, id));
    }
  }

  // Mark connects as notified
  static async markAsNotified(connectIds: number[]) {
    if (connectIds.length === 0) return;

    // Update in batches
    for (const id of connectIds) {
      await db.update(aoiConnects)
        .set({ notified: true })
        .where(eq(aoiConnects.id, id));
    }
  }

  // Get all agents with unbilled connects
  static async getAgentsWithUnbilledConnects() {
    const allConnects = await db.select()
      .from(aoiConnects)
      .where(eq(aoiConnects.billed, false));

    // Group by agent
    const agentStats = new Map();

    for (const connect of allConnects) {
      if (!agentStats.has(connect.agentId)) {
        agentStats.set(connect.agentId, {
          agentId: connect.agentId,
          unbilledConnects: 0,
          unbilledAmount: 0
        });
      }

      const stats = agentStats.get(connect.agentId);
      stats.unbilledConnects++;
      stats.unbilledAmount += 8.00;
    }

    return Array.from(agentStats.values());
  }
}