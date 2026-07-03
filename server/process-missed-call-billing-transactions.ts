/**
 * Process Missed Call Billing Transactions
 * 
 * Checks billing_transactions for missed_call transactions and:
 * 1. Pauses the account (disables VDP/inbound)
 * 2. Creates missed call notification record (triggers VDP alert)
 * 3. Ensures proper notification is sent
 * 
 * This runs separately from the billing transaction creation to handle
 * missed calls that were already billed.
 */

import { supabaseAdmin } from './supabase';

const MISSED_CALL_AMOUNT = 4.00;

interface MissedCallTransaction {
  transaction_id: string;
  agent_email: string;
  agent_associate_id: number | null;
  agent_name: string | null;
  transaction_date: string;
  lead_name: string | null;
  lead_phone: string | null;
  metadata: any;
}

// Pause account by disabling VDP/inbound connections
async function pauseAccountForMissedCall(agentEmail: string): Promise<boolean> {
  if (!supabaseAdmin || !agentEmail) return false;

  try {
    // Check if already paused first
    const alreadyPaused = await isAccountAlreadyPaused(agentEmail);
    if (alreadyPaused) {
      return false; // Already paused, no action needed
    }

    // Disable VDP by setting VDPACTIVE to INACTIVE in customers table
    const { error } = await supabaseAdmin
      .from('customers')
      .update({ VDPACTIVE: 'INACTIVE' })
      .ilike('company_email', agentEmail.toLowerCase());

    if (error) {
      console.error(`❌ Failed to pause account for ${agentEmail}:`, error);
      return false;
    } else {
      console.log(`✅ Account paused (VDP disabled) for ${agentEmail} due to missed call`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error pausing account for ${agentEmail}:`, error);
    return false;
  }
}

// Create missed call notification record (triggers VDP alert)
async function createMissedCallNotificationRecord(
  transaction: MissedCallTransaction
): Promise<void> {
  if (!supabaseAdmin || !transaction.agent_email) return;

  try {
    // Import missed call notification service
    const { MissedCallNotificationService } = await import('./missed-call-notification-service');

    // Extract date/time from transaction_date
    const txDate = new Date(transaction.transaction_date);
    const date = txDate.toISOString().split('T')[0];
    const time = txDate.toTimeString().split(' ')[0];

    // Get agent_id from associate_id or metadata
    const agentId = transaction.agent_associate_id?.toString() || 
                    transaction.metadata?.agent_id || 
                    'unknown';

    // Create missed call notification record
    await MissedCallNotificationService.createMissedCallNotification({
      agent_id: agentId,
      agent_name: transaction.agent_name || 'Unknown Agent',
      agent_email: transaction.agent_email,
      phone: transaction.lead_phone || transaction.metadata?.phone || 'unknown',
      lead_name: transaction.lead_name || undefined,
      date: date,
      time: time,
      credit_deduction: MISSED_CALL_AMOUNT,
    });

    console.log(`✅ Created missed call notification record for ${transaction.agent_email}`);
  } catch (error) {
    console.error(`❌ Error creating missed call notification record for ${transaction.agent_email}:`, error);
  }
}

// Check if transaction has already been processed (has notification with account_paused flag)
async function isTransactionAlreadyProcessed(transactionId: string, agentEmail: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  try {
    const { data: existing } = await supabaseAdmin
      .from('agent_notifications')
      .select('id, metadata')
      .eq('agent_email', agentEmail.toLowerCase())
      .eq('metadata->>transaction_id', transactionId)
      .limit(1);

    if (existing && existing.length > 0) {
      const notification = existing[0];
      // Check if notification has account_paused flag set to true
      return notification.metadata?.account_paused === true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error checking if transaction ${transactionId} already processed:`, error);
    return false; // On error, assume not processed to be safe
  }
}

// Check if account is already paused
async function isAccountAlreadyPaused(agentEmail: string): Promise<boolean> {
  if (!supabaseAdmin || !agentEmail) return false;

  try {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('VDPACTIVE')
      .ilike('company_email', agentEmail.toLowerCase())
      .limit(1)
      .single();

    return customer?.VDPACTIVE === 'INACTIVE';
  } catch (error) {
    return false; // On error, assume not paused to be safe
  }
}

// Update notification with pause message if not already updated
async function updateBillingNotification(transaction: MissedCallTransaction): Promise<void> {
  if (!supabaseAdmin || !transaction.agent_email) return;

  try {
    // Check if notification already exists and has been updated
    const { data: existing } = await supabaseAdmin
      .from('agent_notifications')
      .select('id, metadata')
      .eq('agent_email', transaction.agent_email.toLowerCase())
      .eq('metadata->>transaction_id', transaction.transaction_id)
      .limit(1);

    if (existing && existing.length > 0) {
      const notification = existing[0];
      // Check if already updated
      if (notification.metadata?.account_paused === true) {
        return; // Already updated
      }
    }

    // Update or create notification with pause message
    const { error } = await supabaseAdmin
      .from('agent_notifications')
      .upsert({
        agent_email: transaction.agent_email.toLowerCase(),
        notification_type: 'billing_transaction',
        title: `🚨 Account Paused - Missed Call Charge`,
        message: `Your account has been paused to prevent further missed call charges. You were charged $${MISSED_CALL_AMOUNT.toFixed(2)} (${MISSED_CALL_AMOUNT} credits)${transaction.lead_name ? ` for ${transaction.lead_name}` : ''}. Please review the missed call policy to enable inbound connections.`,
        read: false,
        metadata: {
          transaction_type: 'missed_call',
          transaction_id: transaction.transaction_id,
          amount_usd: MISSED_CALL_AMOUNT,
          credits_charged: MISSED_CALL_AMOUNT,
          lead_name: transaction.lead_name,
          account_paused: true,
          requires_policy_review: true,
        },
      }, {
        onConflict: 'agent_email,metadata->transaction_id',
      });

    if (error) {
      console.error(`❌ Error updating notification for ${transaction.agent_email}:`, error);
    } else {
      console.log(`✅ Updated notification for ${transaction.agent_email}`);
    }
  } catch (error) {
    console.error(`❌ Error updating billing notification for ${transaction.agent_email}:`, error);
  }
}

// Process missed call billing transactions
export async function processMissedCallBillingTransactions(): Promise<void> {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return;
  }

  try {
    console.log('🔍 Checking billing_transactions for missed_call transactions...');

    // Get all missed_call transactions that may need processing
    const { data: transactions, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, agent_associate_id, agent_name, transaction_date, lead_name, lead_phone, metadata')
      .eq('transaction_type', 'missed_call')
      .order('transaction_date', { ascending: false })
      .limit(1000); // Process up to 1000 at a time

    if (error) {
      console.error('❌ Error fetching missed call transactions:', error);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('✅ No missed call transactions found');
      return;
    }

    console.log(`📋 Found ${transactions.length} missed call transactions to check`);

    let processed = 0;
    let skipped = 0;
    let paused = 0;
    let notificationsCreated = 0;

    // Process each transaction - only NEW ones that haven't been processed yet
    for (const transaction of transactions) {
      if (!transaction.agent_email) {
        continue;
      }

      try {
        // Check if this transaction has already been processed
        const alreadyProcessed = await isTransactionAlreadyProcessed(
          transaction.transaction_id,
          transaction.agent_email
        );

        if (alreadyProcessed) {
          skipped++;
          continue; // Skip - already processed
        }

        // This is a NEW transaction - process it
        // 1. Pause account (if not already paused)
        const wasPaused = await pauseAccountForMissedCall(transaction.agent_email);
        if (wasPaused) {
          paused++;
        }

        // 2. Create missed call notification record (triggers VDP alert)
        await createMissedCallNotificationRecord(transaction);
        notificationsCreated++;

        // 3. Update/create billing notification with pause message
        await updateBillingNotification(transaction);

        processed++;
      } catch (error) {
        console.error(`❌ Error processing transaction ${transaction.transaction_id}:`, error);
      }
    }

    console.log(`\n✅ Processed ${processed} NEW missed call transactions`);
    console.log(`   ⏭️  Skipped ${skipped} already processed transactions`);
    console.log(`   🚫 Accounts paused: ${paused}`);
    console.log(`   🔔 Notifications created: ${notificationsCreated}`);
  } catch (error) {
    console.error('❌ Error in processMissedCallBillingTransactions:', error);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('process-missed-call-billing-transactions.ts')) {
  processMissedCallBillingTransactions()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}


