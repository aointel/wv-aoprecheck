/**
 * Generate ALL-TIME Verification Report
 * Shows verification stats grouped by month since inception
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function generateAllTimeReport() {
  console.log('\n📊 GENERATING ALL-TIME VERIFICATION REPORT\n');
  console.log('='.repeat(60));

  try {
    // Fetch ALL verification sessions
    console.log('📥 Fetching all verification sessions from database...');
    
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('*, premium')
      .or('session_type.is.null,session_type.neq.demo') // Exclude demo sessions
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`✅ Fetched ${sessions?.length || 0} total sessions`);

    // Deduplicate by phone number (keep first occurrence)
    const seenPhones = new Set();
    const uniqueSessions = sessions.filter(session => {
      if (!session.phone) return false;
      
      const cleanPhone = session.phone.replace(/\D/g, '');
      if (!cleanPhone || seenPhones.has(cleanPhone)) {
        return false;
      }
      seenPhones.add(cleanPhone);
      return true;
    });

    console.log(`✅ After deduplication: ${uniqueSessions.length} unique sessions`);

    // Group by month
    const monthStats = {};
    const uniqueAgents = new Set();

    uniqueSessions.forEach(session => {
      const date = new Date(session.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      if (!monthStats[monthKey]) {
        monthStats[monthKey] = {
          month: monthLabel,
          completedPhone: 0,
          completedZoom: 0,
          total: 0
        };
      }

      if (session.verification_method === 'phone') {
        monthStats[monthKey].completedPhone++;
      } else if (session.verification_method === 'zoom') {
        monthStats[monthKey].completedZoom++;
      }
      monthStats[monthKey].total++;

      // Track unique agents
      const agentId = session.agent_email || 
                      (session.agent_first_name && session.agent_last_name 
                        ? `${session.agent_first_name} ${session.agent_last_name}`.trim().toLowerCase() 
                        : null);
      if (agentId) {
        uniqueAgents.add(agentId);
      }
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthStats).sort().map(key => monthStats[key]);

    // Calculate totals
    const totalCompletedPhone = sortedMonths.reduce((sum, month) => sum + month.completedPhone, 0);
    const totalCompletedZoom = sortedMonths.reduce((sum, month) => sum + month.completedZoom, 0);
    const totalApplications = totalCompletedPhone + totalCompletedZoom;
    const totalUniqueAgents = uniqueAgents.size;

    console.log(`\n📊 ALL-TIME TOTALS:`);
    console.log(`   Completed Phone: ${totalCompletedPhone}`);
    console.log(`   Completed Zoom: ${totalCompletedZoom}`);
    console.log(`   Total Verifications: ${totalApplications}`);
    console.log(`   Unique Agents: ${totalUniqueAgents}`);
    console.log(`   Months of Data: ${sortedMonths.length}`);

    // Generate HTML report
    const html = generateEmailHTML(sortedMonths, {
      totalCompletedPhone,
      totalCompletedZoom,
      totalApplications,
      totalUniqueAgents,
      reportDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    });

    // Save to file
    const outputPath = path.join(process.cwd(), 'verification-alltime-report.html');
    fs.writeFileSync(outputPath, html);
    
    console.log(`\n✅ Report saved to: ${outputPath}`);
    console.log('\n📧 Open this file in your browser to view the report!\n');

  } catch (error) {
    console.error('❌ Error generating report:', error);
  }
}

function generateEmailHTML(monthStats, totals) {
  const monthRows = monthStats.map(month => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${month.month}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #4facfe; font-weight: 600;">${month.completedPhone}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #43e97b; font-weight: 600;">${month.completedZoom}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0; font-weight: 600;">${month.total}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7fa;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 32px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 18px;
    }
    .content {
      padding: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      padding: 20px;
      border-radius: 10px;
      color: white;
      text-align: center;
    }
    .stat-card.phone {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    .stat-card.zoom {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }
    .stat-card.agents {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    .stat-card.alp {
      background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
    }
    .stat-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      text-transform: uppercase;
      opacity: 0.9;
      font-weight: 500;
    }
    .stat-card .number {
      font-size: 36px;
      font-weight: 700;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    tr:hover {
      background-color: #f8f9fa;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ AO Precheck - ALL TIME REPORT</h1>
      <p>Complete Verification History</p>
      <p style="font-size: 14px; margin-top: 10px;">Generated: ${totals.reportDate}</p>
    </div>

    <div class="content">
      <div class="stats-grid">
        <div class="stat-card phone">
          <h3>📞 Phone Verifications</h3>
          <div class="number">${totals.totalCompletedPhone}</div>
        </div>
        <div class="stat-card zoom">
          <h3>📹 Zoom Verifications</h3>
          <div class="number">${totals.totalCompletedZoom}</div>
        </div>
        <div class="stat-card">
          <h3>✅ Total Verifications</h3>
          <div class="number">${totals.totalApplications}</div>
        </div>
        <div class="stat-card agents">
          <h3>👥 Unique Agents</h3>
          <div class="number">${totals.totalUniqueAgents}</div>
        </div>
      </div>

      <h2 style="margin: 30px 0 15px 0; color: #333;">Monthly Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th style="text-align: center;">📞 Phone</th>
            <th style="text-align: center;">📹 Zoom</th>
            <th style="text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${monthRows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p><strong>AO Intelligence</strong> | Verification Report System</p>
      <p style="margin-top: 5px;">All-Time Data | Deduplicated by Phone Number</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Run the report
generateAllTimeReport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

