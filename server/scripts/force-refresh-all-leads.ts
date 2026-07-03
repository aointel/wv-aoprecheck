import { supabaseAdmin } from "../supabase";
import { outboundDialerLeadCache } from "../outbound-dialer-lead-cache";

async function forceRefreshAllLeads() {
  console.log('🔄 Starting force refresh for all agents...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  try {
    // Get all unique agent emails from masterlead table
    console.log('📊 Fetching all agent emails from masterlead...');
    const { data: leads, error } = await supabaseAdmin
      .from('masterlead')
      .select('cn_email')
      .not('cn_email', 'is', null)
      .limit(50000);

    if (error) {
      console.error('❌ Error fetching agent emails:', error);
      process.exit(1);
    }

    // Get unique emails
    const uniqueEmails = new Set<string>();
    (leads || []).forEach(lead => {
      if (lead.cn_email) {
        uniqueEmails.add(lead.cn_email.toLowerCase().trim());
      }
    });

    const emailArray = Array.from(uniqueEmails);
    console.log(`📋 Found ${emailArray.length} unique agent emails\n`);

    // Clear cache and refresh for each agent
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emailArray.length; i++) {
      const email = emailArray[i];
      try {
        console.log(`[${i + 1}/${emailArray.length}] Refreshing ${email}...`);
        
        // Clear cache
        outboundDialerLeadCache.clearCache(email);
        
        // Force refresh (async but we don't wait)
        outboundDialerLeadCache.refreshAgentLeads(email).catch(err => {
          console.error(`  ⚠️ Error refreshing ${email}:`, err.message);
        });
        
        successCount++;
        
        // Small delay to avoid overwhelming the system
        if ((i + 1) % 10 === 0) {
          console.log(`  ✅ Processed ${i + 1} agents, pausing 1 second...\n`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ Force refresh completed!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${emailArray.length}`);

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
forceRefreshAllLeads()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });


