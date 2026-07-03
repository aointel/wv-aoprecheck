import { supabase } from './server/supabase.ts';

async function lookupAgentIds() {
  const numericIds = [
    '103004', '63603', '103725', '67222', '124235', '159521', 
    '131279', '126829', '103', '004', '235', '124', 
    '160711', '130786', '400', '38431', '134', '725', 
    '134400', '829', '126', '118421', '117239'
  ];

  console.log('🔍 Looking up agent IDs in Supabase customers table...\n');

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('associate_id, company_email, first_name, last_name')
      .in('associate_id', numericIds);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ FOUND EMAIL MAPPINGS:');
    console.log('========================');
    
    const mappings = {};
    data.forEach(customer => {
      const id = customer.associate_id.toString();
      const email = customer.company_email;
      const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      
      mappings[id] = email;
      console.log(`${id} → ${email} (${name})`);
    });

    console.log('\n❌ MISSING IDs (not found in customer database):');
    const foundIds = data.map(d => d.associate_id.toString());
    const missingIds = numericIds.filter(id => !foundIds.includes(id));
    missingIds.forEach(id => console.log(`${id} → NOT FOUND`));

    console.log('\n📋 CORRECTED CSV ENTRIES:');
    console.log('=========================');
    Object.keys(mappings).forEach(id => {
      console.log(`${mappings[id]},XXX  (was: ${id},XXX)`);
    });

    return mappings;

  } catch (error) {
    console.error('❌ Lookup failed:', error);
  }
}

lookupAgentIds();