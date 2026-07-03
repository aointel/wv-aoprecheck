import { supabaseAdmin } from './supabase.js';
import fs from 'fs';

async function exportAgentProfilesToCSV() {
  console.log('📋 Exporting ALL agent_profiles to CSV...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    process.exit(1);
  }

  try {
    // Fetch ALL agent_profiles in batches
    let allProfiles: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let allFetched = false;

    while (!allFetched) {
      const { data: batchData, error: batchError } = await supabaseAdmin
        .from('agent_profiles')
        .select('email, mga_team, rga_team, first_name, last_name')
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        console.error(`❌ Error fetching batch (offset ${offset}):`, batchError);
        break;
      }

      if (batchData && batchData.length > 0) {
        allProfiles = [...allProfiles, ...batchData];
        console.log(`✅ Fetched batch: ${batchData.length} profiles (total: ${allProfiles.length})`);
        offset += batchSize;

        if (batchData.length < batchSize) {
          allFetched = true;
        }
      } else {
        allFetched = true;
      }
    }

    console.log(`\n✅ Total profiles fetched: ${allProfiles.length}\n`);

    // Create CSV
    const columns = ['email', 'first_name', 'last_name', 'mga_team', 'rga_team'];
    const csvRows: string[] = [];

    // Header
    csvRows.push(columns.join(','));

    // Data rows
    allProfiles.forEach(profile => {
      const row = columns.map(col => {
        const val = profile[col] || '';
        const strVal = String(val);
        // Escape commas, quotes, and newlines
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const filename = 'agent-profiles-export.csv';
    fs.writeFileSync(filename, csvContent, 'utf-8');

    console.log(`✅ CSV exported to ${filename}`);
    console.log(`📊 Total rows: ${allProfiles.length}`);
    console.log(`📊 Columns: ${columns.join(', ')}`);

    // Show sample data
    console.log('\n📋 Sample data (first 5 rows):');
    console.log(csvRows.slice(0, 6).join('\n'));

    // Show stats
    const withMga = allProfiles.filter(p => p.mga_team && p.mga_team.trim() !== '' && p.mga_team !== '-').length;
    const withRga = allProfiles.filter(p => p.rga_team && p.rga_team.trim() !== '' && p.rga_team !== '-').length;
    const withBoth = allProfiles.filter(p => 
      p.mga_team && p.mga_team.trim() !== '' && p.mga_team !== '-' &&
      p.rga_team && p.rga_team.trim() !== '' && p.rga_team !== '-'
    ).length;

    console.log('\n📊 Statistics:');
    console.log(`   Total profiles: ${allProfiles.length}`);
    console.log(`   With MGA: ${withMga} (${((withMga / allProfiles.length) * 100).toFixed(1)}%)`);
    console.log(`   With RGA: ${withRga} (${((withRga / allProfiles.length) * 100).toFixed(1)}%)`);
    console.log(`   With both MGA and RGA: ${withBoth} (${((withBoth / allProfiles.length) * 100).toFixed(1)}%)`);

    // Check for coreytrenk specifically
    const coreytrenk = allProfiles.find(p => 
      p.email && String(p.email).toLowerCase().includes('coreytrenk')
    );
    if (coreytrenk) {
      console.log('\n🔍 Found coreytrenk:');
      console.log(`   Email: ${coreytrenk.email}`);
      console.log(`   MGA: ${coreytrenk.mga_team || 'NULL'}`);
      console.log(`   RGA: ${coreytrenk.rga_team || 'NULL'}`);
      console.log(`   Name: ${coreytrenk.first_name || ''} ${coreytrenk.last_name || ''}`);
    } else {
      console.log('\n⚠️ coreytrenk NOT found in agent_profiles');
    }

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('export-agent-profiles-to-csv')) {
  exportAgentProfilesToCSV()
    .then(() => {
      console.log('\n✅ Export complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { exportAgentProfilesToCSV };
