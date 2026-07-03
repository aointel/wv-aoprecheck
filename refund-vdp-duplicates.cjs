#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Duplicate counts by email (from earlier analysis)
const duplicatesByEmail = {
  'richiealtig@aoglobelife.com': 19,
  'patriciasantamarina@aoglobelife.com': 16,
  'cindysheppard@aoglobelife.com': 14,
  'susannahart@aoglobelife.com': 10,
  'anitaruiz@aoglobelife.com': 9,
  'josephinewashington@aoglobelife.com': 8,
  'thomasgrant@aoglobelife.com': 8,
  'heatherschmidt@aoglobelife.com': 4,
  'carmenpierce@aoglobelife.com': 4,
  'lucyoliva@aoglobelife.com': 3,
  'carleyburgess@aoglobelife.com': 2,
  'melissawilson@aoglobelife.com': 2,
  'stephaniesmith@aoglobelife.com': 2,
  'oliviawalker@aoglobelife.com': 2,
  'laurenviloria@aoglobelife.com': 2,
  'jessicabrown@aoglobelife.com': 2
};

const COST_PER_DUPLICATE = 8; // $8 per duplicate VDP call

async function refundDuplicates() {
  console.log('💰 REFUNDING DUPLICATE VDP CHARGES\n');
  console.log(`Rate: $${COST_PER_DUPLICATE} per duplicate call\n`);
  
  let totalRefunded = 0;
  let successCount = 0;
  let failCount = 0;
  
  for (const [email, duplicateCount] of Object.entries(duplicatesByEmail)) {
    const refundAmount = duplicateCount * COST_PER_DUPLICATE;
    
    console.log(`\n📧 ${email}`);
    console.log(`   Duplicates: ${duplicateCount}`);
    console.log(`   Refund: $${refundAmount}`);
    
    try {
      // Get current credits
      const { data: currentCredits, error: fetchError } = await supabase
        .from('user_credits')
        .select('credits_purchased, credits_remaining')
        .eq('email', email)
        .maybeSingle();
      
      if (fetchError) {
        console.error(`   ❌ Error fetching credits: ${fetchError.message}`);
        failCount++;
        continue;
      }
      
      if (!currentCredits) {
        console.warn(`   ⚠️ No credit record found - skipping`);
        failCount++;
        continue;
      }
      
      console.log(`   Current: $${currentCredits.credits_purchased || 0} purchased, $${currentCredits.credits_remaining || 0} remaining`);
      
      // Update credits
      const newPurchased = (currentCredits.credits_purchased || 0) + refundAmount;
      const newRemaining = (currentCredits.credits_remaining || 0) + refundAmount;
      
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          credits_purchased: newPurchased,
          credits_remaining: newRemaining,
          last_updated: new Date().toISOString()
        })
        .eq('email', email);
      
      if (updateError) {
        console.error(`   ❌ Error updating credits: ${updateError.message}`);
        failCount++;
        continue;
      }
      
      console.log(`   ✅ Refunded $${refundAmount} - New totals: $${newPurchased} purchased, $${newRemaining} remaining`);
      totalRefunded += refundAmount;
      successCount++;
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 REFUND SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount} agents`);
  console.log(`❌ Failed: ${failCount} agents`);
  console.log(`💵 Total refunded: $${totalRefunded}`);
  console.log(`📈 Total duplicates: ${Object.values(duplicatesByEmail).reduce((sum, count) => sum + count, 0)}`);
}

refundDuplicates().catch(console.error);

