#!/usr/bin/env node

/**
 * Generate and send VDP calls weekly reports to all agents
 * 
 * Usage: node generate-vdp-reports.cjs
 */

const path = require('path');

async function generateReports() {
  try {
    console.log('\n🚀 GENERATING VDP CALLS WEEKLY REPORTS\n');
    console.log('='.repeat(60));
    
    // Import the service
    const { AgentWeeklyEmailService } = await import('./server/agent-weekly-email-service.js');
    
    // Create service instance
    const emailService = new AgentWeeklyEmailService();
    
    // Send all weekly reports
    console.log('\n📧 Sending weekly reports to all agents...\n');
    await emailService.sendWeeklyReportSummaries();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ VDP REPORTS GENERATION COMPLETE!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
generateReports()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

