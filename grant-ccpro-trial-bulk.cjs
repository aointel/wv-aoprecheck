/**
 * Bulk grant Call Connector Pro 30-day trial subscriptions
 * 1. Find emails in Supabase customers table by name
 * 2. Create/find Stripe customers by email
 * 3. Subscribe each to Call Connector Pro with 30-day trial, no card required
 */

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
);

const stripe = new Stripe('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');

const NAMES = [
  'Amy Beauchamp',
  'Andrew Walker',
  'Anthony Greco',
  'Brandon Cabeceiras',
  'Christian Mercado',
  'Christina Altvater',
  'Cynthia Schomp',
  'Drew Sharp',
  'Felipe Santanna',
  'Gabriel DeSouza',
  'Helen Bradley',
  'Junia Williams',
  'Kaitlyn Tuckmantel',
  'Kimberly Alston',
  'Lalitha Janardhanan',
  'Lisa Smithson',
  'Lynell Collier',
  'Matheus Bob',
  'Michael Shepler',
  'Mistie Cockman',
  'Natalia Monteiro',
  'Nicole Paul',
  'Nicolette van Rensburg',
  'Nolangie Rosado',
  'Renata Johnson',
  'Robert Gilman',
  'Sean Hansen',
  'Sean Melaven',
  'Sophia Limonciello',
  'Terrelle Goslee-Adams',
  'Teshaun Devoise',
  'Theresa Bryson',
  'Vitor Buche',
  'Zaki Blanding',
];

async function findCCProPriceId() {
  console.log('\n🔍 Looking up Call Connector Pro price ID from Stripe...');
  const products = await stripe.products.list({ limit: 100, active: true });
  
  for (const product of products.data) {
    const name = product.name.toLowerCase();
    if (name.includes('call connector') && (name.includes('pro') || name.includes('professional'))) {
      console.log(`✅ Found product: "${product.name}" (${product.id})`);
      // Get the default price or first active price
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
      if (prices.data.length > 0) {
        // Prefer recurring monthly
        const monthly = prices.data.find(p => p.recurring?.interval === 'month');
        const price = monthly || prices.data[0];
        console.log(`   Price: ${price.id} — $${(price.unit_amount / 100).toFixed(2)}/${price.recurring?.interval || 'one-time'}`);
        return price.id;
      }
    }
  }
  
  console.log('\n⚠️  Could not auto-find price. Available products:');
  products.data.forEach(p => console.log(`  - ${p.name} (${p.id})`));
  return null;
}

async function lookupEmailsFromSupabase() {
  console.log('\n📋 Looking up emails in Supabase customers table...\n');
  const found = [];
  const notFound = [];

  for (const name of NAMES) {
    const parts = name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // Try by first + last name
    const { data, error } = await supabase
      .from('customers')
      .select('company_email, personal_email, first_name, last_name, agent_name')
      .ilike('last_name', `%${lastName}%`)
      .ilike('first_name', `%${firstName}%`)
      .limit(3);

    if (error) {
      console.error(`  ❌ DB error for ${name}:`, error.message);
      notFound.push({ name, reason: error.message });
      continue;
    }

    if (data && data.length > 0) {
      const row = data[0];
      const email = (row.company_email || row.personal_email || '').toLowerCase().trim();
      if (email) {
        console.log(`  ✅ ${name} → ${email}`);
        found.push({ name, email });
      } else {
        console.log(`  ⚠️  ${name} → found row but no email`);
        notFound.push({ name, reason: 'no email in row' });
      }
    } else {
      // Try agent_name fallback
      const { data: data2, error: err2 } = await supabase
        .from('customers')
        .select('company_email, personal_email, agent_name, first_name, last_name')
        .ilike('agent_name', `%${lastName}%`)
        .limit(10);

      const match = data2?.find(r => {
        const agentName = (r.agent_name || '').toLowerCase();
        return agentName.includes(firstName.toLowerCase());
      });

      if (match) {
        const email = (match.company_email || match.personal_email || '').toLowerCase().trim();
        if (email) {
          console.log(`  ✅ ${name} → ${email} (agent_name match: "${match.agent_name}")`);
          found.push({ name, email });
        } else {
          console.log(`  ⚠️  ${name} → matched "${match.agent_name}" but no email`);
          notFound.push({ name, reason: 'matched but no email' });
        }
      } else {
        console.log(`  ❌ ${name} → NOT FOUND`);
        notFound.push({ name, reason: 'not found in customers table' });
      }
    }
  }

  return { found, notFound };
}

async function createTrialSubscription(email, name, priceId) {
  // Find or create Stripe customer
  let customer;
  const existing = await stripe.customers.list({ email, limit: 1 });
  
  if (existing.data.length > 0) {
    customer = existing.data[0];
    console.log(`  👤 Found existing Stripe customer: ${customer.id}`);
  } else {
    customer = await stripe.customers.create({ email, name });
    console.log(`  👤 Created new Stripe customer: ${customer.id}`);
  }

  // Check if already has an active/trialing subscription to this price
  const existingSubs = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'all',
    limit: 10,
  });

  const alreadyActive = existingSubs.data.find(sub =>
    ['active', 'trialing'].includes(sub.status) &&
    sub.items.data.some(item => item.price.id === priceId)
  );

  if (alreadyActive) {
    console.log(`  ⏭️  Already has active/trialing subscription (${alreadyActive.id}), skipping`);
    return { skipped: true, subscriptionId: alreadyActive.id };
  }

  // Create subscription with 30-day trial, no payment method required
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: 30,
    payment_settings: {
      save_default_payment_method: 'off',
    },
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'cancel',
      },
    },
    expand: ['latest_invoice'],
  });

  return { skipped: false, subscriptionId: subscription.id, status: subscription.status };
}

async function main() {
  console.log('🚀 Starting bulk CCPro trial grant...\n');

  // Step 1: Find price ID
  const priceId = await findCCProPriceId();
  if (!priceId) {
    console.error('\n❌ Could not determine price ID. Aborting.');
    process.exit(1);
  }

  // Step 2: Look up emails
  const { found, notFound } = await lookupEmailsFromSupabase();

  console.log(`\n📊 Supabase lookup: ${found.length} found, ${notFound.length} not found`);

  if (notFound.length > 0) {
    console.log('\n⚠️  Not found in Supabase:');
    notFound.forEach(n => console.log(`   - ${n.name}: ${n.reason}`));
  }

  // Step 3: Create Stripe subscriptions
  console.log('\n💳 Creating Stripe subscriptions...\n');
  const results = { success: [], skipped: [], failed: [] };

  for (const { name, email } of found) {
    console.log(`\n→ ${name} (${email})`);
    try {
      const result = await createTrialSubscription(email, name, priceId);
      if (result.skipped) {
        results.skipped.push({ name, email, subscriptionId: result.subscriptionId });
      } else {
        console.log(`  ✅ Subscription created: ${result.subscriptionId} (${result.status})`);
        results.success.push({ name, email, subscriptionId: result.subscriptionId });
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      results.failed.push({ name, email, error: err.message });
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  // Final summary
  console.log('\n\n========== SUMMARY ==========');
  console.log(`✅ Subscriptions created: ${results.success.length}`);
  console.log(`⏭️  Already subscribed (skipped): ${results.skipped.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`🔍 Not found in Supabase: ${notFound.length}`);

  if (results.success.length > 0) {
    console.log('\n✅ Created:');
    results.success.forEach(r => console.log(`   ${r.name} (${r.email}) → ${r.subscriptionId}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed:');
    results.failed.forEach(r => console.log(`   ${r.name} (${r.email}): ${r.error}`));
  }

  if (notFound.length > 0) {
    console.log('\n🔍 Not in Supabase (need manual lookup):');
    notFound.forEach(r => console.log(`   ${r.name}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
