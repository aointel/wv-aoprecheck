import cron from 'node-cron';
import { supabaseAdmin } from './supabase.js';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

const MAILGUN_API_KEY = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';
const MAILGUN_DOMAIN = 'mg.connectnow.one';

interface DayStats {
  day: string;
  completedPhone: number;
  completedZoom: number;
  total: number;
}

async function generateDailyReport(daysBack: number = 0) {
  console.log('\n[AO Precheck Report] Generating report...');
  
  try {
    // Get date range - either last 7 days or current week
    const today = new Date();
    let startDate: Date;
    
    if (daysBack > 0) {
      // Last N days mode
      startDate = new Date(today);
      startDate.setDate(today.getDate() - daysBack);
      startDate.setHours(0, 0, 0, 0);
      console.log(`📅 Report mode: Last ${daysBack} days`);
    } else {
      // Current week mode (Monday to current day)
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - daysFromMonday);
      startDate.setHours(0, 0, 0, 0);
      console.log(`📅 Report mode: Current week (Monday to today)`);
    }
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`📅 Report range: ${startDate.toISOString()} to ${endOfDay.toISOString()}`);
    
    // Fetch all verification sessions for the week
    // Exclude demo sessions and sessions with NULL session_type
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*, premium')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .or('session_type.is.null,session_type.neq.demo') // Exclude demo sessions
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    console.log(`✅ Fetched ${sessions?.length || 0} sessions`);
    
    // Deduplicate by phone number (keep first occurrence)
    const seenPhones = new Set<string>();
    const uniqueSessions = sessions.filter(session => {
      if (!session.phone) return false; // Skip sessions without phone numbers
      
      const cleanPhone = session.phone.replace(/\D/g, ''); // Remove non-digits
      if (!cleanPhone || seenPhones.has(cleanPhone)) {
        return false;
      }
      seenPhones.add(cleanPhone);
      return true;
    });
    
    console.log(`✅ After deduplication by phone: ${uniqueSessions.length} unique sessions`);
    
    // Group by day of week (Monday-Sunday)
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayStats: DayStats[] = daysOfWeek.map(day => ({
      day,
      completedPhone: 0,
      completedZoom: 0,
      total: 0
    }));
    
    // Count unique agents
    const uniqueAgents = new Set<string>();
    
    // Process each unique session (ALL sessions, ignore status)
    uniqueSessions.forEach(session => {
      const sessionDate = new Date(session.created_at);
      const sessionDay = sessionDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayIndex = sessionDay === 0 ? 6 : sessionDay - 1; // Convert to Monday=0, Sunday=6
      
      // Count ALL sessions regardless of status
      if (session.verification_method === 'phone') {
        dayStats[dayIndex].completedPhone++;
      } else if (session.verification_method === 'zoom') {
        dayStats[dayIndex].completedZoom++;
      }
      dayStats[dayIndex].total++;
      
      // Track unique agents from all sessions
      const agentId = session.agent_email || 
                      session.agent_first_name && session.agent_last_name 
                        ? `${session.agent_first_name} ${session.agent_last_name}`.trim().toLowerCase() 
                        : null;
      if (agentId) {
        uniqueAgents.add(agentId);
      }
    });
    
    // Calculate totals
    const totalCompletedPhone = dayStats.reduce((sum, day) => sum + day.completedPhone, 0);
    const totalCompletedZoom = dayStats.reduce((sum, day) => sum + day.completedZoom, 0);
    const totalApplications = totalCompletedPhone + totalCompletedZoom;
    const totalUniqueAgents = uniqueAgents.size;
    
    console.log(`\n📊 TOTALS:`);
    console.log(`   Completed Phone: ${totalCompletedPhone}`);
    console.log(`   Completed Zoom: ${totalCompletedZoom}`);
    console.log(`   Total Sessions: ${totalApplications}`);
    console.log(`   Unique Agents: ${totalUniqueAgents}`);
    
    // Generate HTML email
    const html = generateEmailHTML(dayStats, {
      totalCompletedPhone,
      totalCompletedZoom,
      totalApplications,
      totalUniqueAgents,
      reportDate: today.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    });
    
    // Save HTML to file for preview (in test mode)
    if (process.argv[1]?.includes('verification-daily-report')) {
      const fs = await import('fs');
      const path = await import('path');
      const outputPath = path.join(process.cwd(), 'test-verification-report.html');
      fs.writeFileSync(outputPath, html);
      console.log(`📄 Report HTML saved to: ${outputPath}`);
    }
    
    // Send email via Mailgun
    await sendEmail(html);
    
    console.log('✅ Daily report sent successfully\n');
    
  } catch (error) {
    console.error('❌ Error generating daily report:', error);
  }
}

function generateEmailHTML(dayStats: DayStats[], totals: any): string {
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
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 16px;
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
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:hover {
      background-color: #f7fafc;
    }
    .total-row {
      background: #edf2f7;
      font-weight: 600;
    }
    .phone-col {
      color: #3182ce;
      font-weight: 600;
    }
    .zoom-col {
      color: #38a169;
      font-weight: 600;
    }
    .total-col {
      color: #805ad5;
      font-weight: 600;
    }
    .footer {
      background: #f7fafc;
      padding: 20px;
      text-align: center;
      color: #718096;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AO Precheck Report</h1>
      <p>${totals.reportDate}</p>
    </div>
    
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Sessions</h3>
          <div class="number">${totals.totalApplications}</div>
        </div>
        <div class="stat-card phone">
          <h3>Completed Phone</h3>
          <div class="number">${totals.totalCompletedPhone}</div>
        </div>
        <div class="stat-card zoom">
          <h3>Completed Zoom</h3>
          <div class="number">${totals.totalCompletedZoom}</div>
        </div>
        <div class="stat-card agents">
          <h3>Unique Agents</h3>
          <div class="number">${totals.totalUniqueAgents}</div>
        </div>
      </div>
      
      <h2 style="color: #2d3748; margin-bottom: 15px;">Weekly Breakdown (Monday - Sunday)</h2>
      
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Completed Phone</th>
            <th>Completed Zoom</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${dayStats.map(day => `
            <tr>
              <td><strong>${day.day}</strong></td>
              <td class="phone-col">${day.completedPhone}</td>
              <td class="zoom-col">${day.completedZoom}</td>
              <td class="total-col">${day.total}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td><strong>WEEKLY TOTALS</strong></td>
            <td class="phone-col">${totals.totalCompletedPhone}</td>
            <td class="zoom-col">${totals.totalCompletedZoom}</td>
            <td class="total-col">${totals.totalApplications}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>This report excludes duplicate clients and demo sessions.</p>
      <p>Generated automatically by AO Intelligence • ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendEmail(html: string) {
  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({ username: 'api', key: MAILGUN_API_KEY, url: 'https://api.mailgun.net' });
  
  try {
    const result = await mg.messages.create(MAILGUN_DOMAIN, {
      from: 'AO Intelligence Reports <noreply@mg.connectnow.one>',
      to: ['michaelmandella@aoglobelife.com'],
      subject: `AO Precheck Report - ${new Date().toLocaleDateString('en-US')}`,
      html: html
    });
    
    console.log('✅ Email sent via Mailgun:', result);
  } catch (error) {
    console.error('❌ Mailgun error:', error);
  }
}

// Schedule to run daily at 9 AM PST (17:00 UTC)
export function startDailyReportScheduler() {
  console.log('[AO Precheck] Starting report scheduler...');
  console.log('[AO Precheck] Report will be sent daily at 9:00 AM PST (17:00 UTC)');
  
  // Run at 9 AM PST every day (17:00 UTC)
  cron.schedule('0 17 * * *', () => {
    console.log('\n[AO Precheck] Scheduled task triggered');
    generateDailyReport();
  }, {
    timezone: "America/Los_Angeles"
  });
  
  console.log('[AO Precheck] Scheduler started successfully\n');
}

// For testing: generate report immediately
if (process.argv[1]?.includes('verification-daily-report')) {
  console.log('🧪 Running in test mode - generating report immediately...');
  
  // Check if user specified number of days (e.g., --days=7)
  const daysArg = process.argv.find(arg => arg.startsWith('--days='));
  const daysBack = daysArg ? parseInt(daysArg.split('=')[1]) : 0;
  
  if (daysBack > 0) {
    console.log(`📅 Generating report for last ${daysBack} days`);
  } else {
    console.log(`📅 Generating report for current week`);
  }
  
  generateDailyReport(daysBack).then(() => {
    console.log('✅ Test report complete');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Test report failed:', error);
    process.exit(1);
  });
}

