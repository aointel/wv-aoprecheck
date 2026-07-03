/**
 * Grant Call Connector Pro Access to a User
 * Usage: node grant-ccpro-access.cjs <email>
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function grantCCProAccess(email) {
  const normalizedEmail = email.toLowerCase().trim();
  
  console.log(`\n🔍 Checking CCPro access for: ${normalizedEmail}\n`);
  
  // Check current status
  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('company_email, personal_email, CCPRO')
    .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
    .maybeSingle();
  
  if (customerError) {
    console.error('❌ Error checking customer:', customerError);
    return;
  }
  
  if (!customerData) {
    console.log('⚠️  No customer record found. Creating one...');
    
    // Try to create customer record
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        company_email: normalizedEmail,
        personal_email: normalizedEmail,
        CCPRO: true
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating customer:', createError);
      return;
    }
    
    console.log('✅ Created customer record with CCPRO = true');
    console.log('✅ CCPro access granted!');
    return;
  }
  
  console.log('📊 Current Status:');
  console.log(`   Company Email: ${customerData.company_email || 'N/A'}`);
  console.log(`   Personal Email: ${customerData.personal_email || 'N/A'}`);
  console.log(`   CCPRO Flag: ${customerData.CCPRO || false}`);
  
  if (customerData.CCPRO === true || customerData.CCPRO === 'true' || customerData.CCPRO === 1) {
    console.log('\n✅ User already has CCPro access via customers.CCPRO flag');
    return;
  }
  
  // Grant access by setting CCPRO flag
  console.log('\n🔧 Granting CCPro access...');
  
  const { data: updated, error: updateError } = await supabase
    .from('customers')
    .update({ CCPRO: true })
    .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Error updating customer:', updateError);
    return;
  }
  
  console.log('✅ CCPro access granted!');
  console.log(`   Updated CCPRO flag to: ${updated.CCPRO}`);
  console.log('\n💡 User should now have access to Call Connector Pro');
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('❌ Usage: node grant-ccpro-access.cjs <email>');
  console.error('   Example: node grant-ccpro-access.cjs nicolamahaffy@example.com');
  process.exit(1);
}

grantCCProAccess(email).then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
