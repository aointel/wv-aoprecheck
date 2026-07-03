/**
 * Lookup top agents via API endpoint
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';

const veteranAgents = [
  { rank: 1, name: "LEYNA TRAN", production: "$53,813", hasAOIntel: "Yes" },
  { rank: 2, name: "ROBERTO SAMANODIAZ", production: "$50,290", hasAOIntel: "No" },
  { rank: 3, name: "TRAVIS CARPENTER", production: "$49,016", hasAOIntel: "No" },
  { rank: 4, name: "FOUZIEYEH SAAD", production: "$47,664", hasAOIntel: "Yes" },
  { rank: 5, name: "ROGER FREDERICKS", production: "$46,548", hasAOIntel: "Yes" },
  { rank: 6, name: "BLAKE MYERS", production: "$43,900", hasAOIntel: "No" },
  { rank: 7, name: "DIANKA BLASH", production: "$43,236", hasAOIntel: "Yes" },
  { rank: 8, name: "MAHER ALTAIRI", production: "$41,332", hasAOIntel: "No" },
  { rank: 9, name: "LUKE LOPICCOLO", production: "$39,847", hasAOIntel: "Yes" },
  { rank: 10, name: "HEIDI MCMULLIN", production: "$38,754", hasAOIntel: "Yes" },
  { rank: 11, name: "TORIAN FIELDS", production: "$35,984", hasAOIntel: "Yes" },
  { rank: 12, name: "MIKAELA HAYES", production: "$35,395", hasAOIntel: "Yes" },
  { rank: 13, name: "DANIEL TORRES", production: "$35,062", hasAOIntel: "Yes" },
  { rank: 14, name: "CHRISTOPHER LAFOND", production: "$34,642", hasAOIntel: "Yes" },
  { rank: 15, name: "MEGAN SITTO", production: "$31,979", hasAOIntel: "Yes" },
  { rank: 16, name: "MOHMADALI ALWATAN", production: "$31,774", hasAOIntel: "Yes" },
  { rank: 17, name: "HAMID AMZAL", production: "$30,802", hasAOIntel: "No" },
  { rank: 18, name: "MIGUEL QUINONES", production: "$30,775", hasAOIntel: "No" },
  { rank: 19, name: "ROBERT MASON", production: "$30,428", hasAOIntel: "Yes" },
  { rank: 20, name: "MICHAEL FAIR", production: "$29,730", hasAOIntel: "Yes" }
];

const globeAgents = [
  { rank: 1, name: "BLAKE MYERS", production: "$52,513", hasAOIntel: "No" },
  { rank: 2, name: "ALEX TONY", production: "$47,182", hasAOIntel: "No" },
  { rank: 3, name: "MORGAN BONEBERG", production: "$28,151", hasAOIntel: "No" },
  { rank: 4, name: "DANIEL HERNANDEZ", production: "$27,449", hasAOIntel: "No" },
  { rank: 5, name: "EMILY ROGERS", production: "$24,586", hasAOIntel: "No" },
  { rank: 6, name: "COREY TRENK", production: "$22,254", hasAOIntel: "Yes" },
  { rank: 7, name: "STEPHANIE CAHALL", production: "$22,183", hasAOIntel: "No" },
  { rank: 8, name: "DANTE TRINA", production: "$19,751", hasAOIntel: "No" },
  { rank: 9, name: "TYLER BROWN", production: "$19,342", hasAOIntel: "No" },
  { rank: 10, name: "DARRIN WILSON", production: "$17,949", hasAOIntel: "No" },
  { rank: 11, name: "DANIEL HARRIS", production: "$17,941", hasAOIntel: "No" },
  { rank: 12, name: "ANNA DIRCK", production: "$17,458", hasAOIntel: "No" },
  { rank: 13, name: "REESE ROGERS", production: "$17,355", hasAOIntel: "No" },
  { rank: 14, name: "ZACHARIAH SEMLANI", production: "$16,648", hasAOIntel: "No" },
  { rank: 15, name: "JEREMY BRUCE", production: "$16,091", hasAOIntel: "No" },
  { rank: 16, name: "ANTHONY LULGJURAJ", production: "$15,985", hasAOIntel: "Yes" },
  { rank: 17, name: "ROBERT MORLEY", production: "$15,774", hasAOIntel: "No" },
  { rank: 18, name: "KENNETH HOLLOBAUGH", production: "$14,526", hasAOIntel: "No" },
  { rank: 19, name: "JORDAN LEWIS", production: "$14,259", hasAOIntel: "Yes" },
  { rank: 20, name: "NICHOLAS CATENACCI", production: "$14,120", hasAOIntel: "Yes" }
];

async function lookupAgents() {
  console.log('\n🔍 LOOKING UP TOP AGENTS VIA API\n');
  console.log('='.repeat(80));

  const results = [];
  const allAgents = [
    ...veteranAgents.map(a => ({ ...a, market: 'Veteran' })),
    ...globeAgents.map(a => ({ ...a, market: 'Globe' }))
  ];

  console.log(`\n📊 Processing ${allAgents.length} agents...\n`);

  for (const agent of allAgents) {
    try {
      const response = await fetch(`${API_URL}/api/producerlist?name=${encodeURIComponent(agent.name)}`);
      
      if (!response.ok) {
        console.log(`❌ API error for ${agent.name}: ${response.status}`);
        results.push({
          market: agent.market,
          rank: agent.rank,
          name: agent.name,
          production: agent.production,
          has_ao_intel: agent.hasAOIntel,
          associate_id: 'API ERROR',
          mga: 'API ERROR',
          phone: 'API ERROR',
          email: 'API ERROR'
        });
        continue;
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const row = data[0];
        console.log(`✅ Found: ${agent.name} - Associate ID: ${row.associate_id}, MGA: ${row.mga}, Phone: ${row.phone}`);
        results.push({
          market: agent.market,
          rank: agent.rank,
          name: agent.name,
          production: agent.production,
          has_ao_intel: agent.hasAOIntel,
          associate_id: row.associate_id || 'N/A',
          mga: row.mga || 'N/A',
          phone: row.phone || 'N/A',
          email: row.company_email || 'N/A'
        });
      } else {
        console.log(`❌ Not found: ${agent.name}`);
        results.push({
          market: agent.market,
          rank: agent.rank,
          name: agent.name,
          production: agent.production,
          has_ao_intel: agent.hasAOIntel,
          associate_id: 'NOT FOUND',
          mga: 'NOT FOUND',
          phone: 'NOT FOUND',
          email: 'NOT FOUND'
        });
      }
    } catch (error) {
      console.error(`❌ Error looking up ${agent.name}:`, error.message);
      results.push({
        market: agent.market,
        rank: agent.rank,
        name: agent.name,
        production: agent.production,
        has_ao_intel: agent.hasAOIntel,
        associate_id: 'ERROR',
        mga: 'ERROR',
        phone: 'ERROR',
        email: 'ERROR'
      });
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Generate CSV
  const csvHeader = 'Market,Rank,Name,Production,Has_AO_Intel,Associate_ID,MGA,Phone,Email\n';
  const csvRows = results.map(r => {
    const escapeCsv = (str) => {
      if (!str) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    
    return [
      escapeCsv(r.market),
      escapeCsv(r.rank),
      escapeCsv(r.name),
      escapeCsv(r.production),
      escapeCsv(r.has_ao_intel),
      escapeCsv(r.associate_id),
      escapeCsv(r.mga),
      escapeCsv(r.phone),
      escapeCsv(r.email)
    ].join(',');
  }).join('\n');

  const csvContent = csvHeader + csvRows;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const csvFilename = `top-agents-lookup-${timestamp}.csv`;
  const csvPath = path.join(process.cwd(), csvFilename);

  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Agents Looked Up: ${results.length}`);
  console.log(`\n📄 CSV Report saved to: ${csvFilename}`);
  console.log(`   Full path: ${csvPath}`);
  console.log('\n✨ Done!\n');
}

lookupAgents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

