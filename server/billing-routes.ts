import { Router } from 'express';
import { SimpleBillingService } from './simple-billing-service';
import { MissedCallNotificationService } from './missed-call-notification-service';
import { NotificationScheduler } from './notification-scheduler';
import { subDays, startOfWeek, startOfMonth } from 'date-fns';

export const billingRouter = Router();

// Get user usage statistics
billingRouter.get('/usage/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;

    const stats = await SimpleBillingService.getUserUsageStats(userEmail);
    
    res.json({
      success: true,
      userEmail,
      usage: stats,
    });
  } catch (error) {
    console.error('❌ Failed to get usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Start call tracking
billingRouter.post('/call/start', async (req, res) => {
  try {
    const { callType, callId, leadPhone, leadName, platform, userEmail } = req.body;
    
    if (!callType || !callId || !platform || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields: callType, callId, platform, userEmail' });
    }

    const trackingId = await SimpleBillingService.startCallTracking({
      userId: userEmail,
      userEmail,
      callType,
      callId,
      leadPhone,
      leadName,
      platform,
    });

    res.json({
      success: true,
      trackingId,
      message: 'Call tracking started',
    });
  } catch (error) {
    console.error('❌ Failed to start call tracking:', error);
    res.status(500).json({ error: 'Failed to start call tracking' });
  }
});

// End call tracking
billingRouter.post('/call/end/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    await SimpleBillingService.endCallTracking(trackingId);

    res.json({
      success: true,
      message: 'Call tracking ended and billed',
    });
  } catch (error) {
    console.error('❌ Failed to end call tracking:', error);
    res.status(500).json({ error: 'Failed to end call tracking' });
  }
});

// Start video meeting tracking
billingRouter.post('/video/start', async (req, res) => {
  try {
    const { meetingId, meetingType, roomUrl, hostRoomUrl, leadName, leadPhone, userEmail } = req.body;
    
    if (!meetingId || !meetingType || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields: meetingId, meetingType, userEmail' });
    }

    const trackingId = await SimpleBillingService.startVideoMeetingTracking({
      userId: userEmail,
      userEmail,
      meetingId,
      meetingType,
      roomUrl,
      hostRoomUrl,
      leadName,
      leadPhone,
    });

    res.json({
      success: true,
      trackingId,
      message: 'Video meeting tracking started',
    });
  } catch (error) {
    console.error('❌ Failed to start video tracking:', error);
    res.status(500).json({ error: 'Failed to start video meeting tracking' });
  }
});

// End video meeting tracking
billingRouter.post('/video/end/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    await SimpleBillingService.endVideoMeetingTracking(trackingId);

    res.json({
      success: true,
      message: 'Video meeting tracking ended and billed',
    });
  } catch (error) {
    console.error('❌ Failed to end video tracking:', error);
    res.status(500).json({ error: 'Failed to end video meeting tracking' });
  }
});

// Twilio webhook for call events
billingRouter.post('/webhook/twilio-call', async (req, res) => {
  try {
    const { CallSid, CallStatus, From, To } = req.body;
    
    // Extract user email from call context (this would need to be enhanced based on your Twilio setup)
    const userEmail = req.query.userEmail as string;
    
    if (userEmail && CallSid && CallStatus) {
      await SimpleBillingService.handleTwilioCallWebhook(CallSid, CallStatus, userEmail);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Failed to handle Twilio webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Get current month usage summary
billingRouter.get('/current-usage/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;

    const stats = await SimpleBillingService.getUserUsageStats(userEmail);
    
    res.json({
      success: true,
      userEmail,
      currentMonth: {
        totalMinutes: stats.currentMonth.callMinutes + stats.currentMonth.videoMinutes,
        callMinutes: stats.currentMonth.callMinutes,
        videoMinutes: stats.currentMonth.videoMinutes,
        creditsUsed: stats.currentMonth.creditsUsed,
        estimatedCost: stats.currentMonth.cost,
      },
      billingRate: 0.10, // $0.10 per minute
    });
  } catch (error) {
    console.error('❌ Failed to get current usage:', error);
    res.status(500).json({ error: 'Failed to fetch current usage' });
  }
});

// Professional Billing Reports - CSV Downloads  
billingRouter.get('/report/connect', async (req, res) => {
  try {
    console.log('🔥 Generating AO Connect billing report from CSV data...');
    
    const { SimpleCsvBilling } = await import('./simple-csv-billing');
    const csvData = await SimpleCsvBilling.generateBillingReport();
    
    console.log('✅ AO Connect billing report generated successfully');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ao-connect-billing-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating AO Connect billing report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/report/plus', async (req, res) => {
  try {
    const { BillingService } = await import('./billing-service');
    const csvData = await BillingService.generatePlusReport();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ao-plus-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating AO Plus report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/report/precheck', async (req, res) => {
  try {
    const { BillingService } = await import('./billing-service');
    const csvData = await BillingService.generatePrecheckReport();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ao-precheck-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating AO Precheck report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/report/recruit', async (req, res) => {
  try {
    const { BillingService } = await import('./billing-service');
    const csvData = await BillingService.generateRecruitReport();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ao-recruit-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating AO Recruit report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/report/verification', async (req, res) => {
  try {
    const { BillingService } = await import('./billing-service');
    const csvData = await BillingService.generateVerificationReport();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="verification-calls-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating Verification report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/report/other', async (req, res) => {
  try {
    const { BillingService } = await import('./billing-service');
    const csvData = await BillingService.generateOtherServicesReport();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="other-services-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating Other Services report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

billingRouter.get('/mga-report', async (req, res) => {
  try {
    console.log('🔥 Generating REAL MGA report...');
    
    const { RealBillingService } = await import('./real-billing-service');
    const csvData = await RealBillingService.generateRealMGAReport();
    
    console.log('✅ REAL MGA report generated successfully');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="mga-agency-real-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating REAL MGA report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// MGA Hierarchy Breakdown - JSON format for dashboard
billingRouter.get('/mga-hierarchy', async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;
    console.log(`🔥 Generating MGA hierarchy breakdown for user: ${userEmail}`);
    
    
    const { RealBillingService } = await import('./real-billing-service');
    const hierarchyData = await RealBillingService.generateMGAHierarchyBreakdown();
    
    console.log('✅ MGA hierarchy breakdown generated successfully');
    res.json({
      success: true,
      hierarchy: hierarchyData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating MGA hierarchy breakdown:', error);
    res.status(500).json({ error: 'Failed to generate MGA hierarchy breakdown' });
  }
});

billingRouter.get('/summary', async (req, res) => {
  try {
    console.log('🔥 Generating REAL billing summary...');
    
    const { RealBillingService } = await import('./real-billing-service');
    const csvData = await RealBillingService.generateRealBillingSummary();
    
    console.log('✅ REAL billing summary generated successfully');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="billing-summary-real-report.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('❌ Error generating REAL billing summary:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Missed Call Billing Endpoints
billingRouter.post('/missed-calls/process', async (req, res) => {
  try {
    console.log('💸 Processing missed call billing for all agents...');
    
    const { MissedCallBillingService } = await import('./missed-call-billing-service');
    const result = await MissedCallBillingService.processComprehensiveMissedCallBilling();
    
    console.log('✅ Missed call billing processed successfully');
    res.json({
      success: result.success,
      processed: result.results.length,
      totalBilled: result.results.reduce((sum, r) => sum + r.billingAmount, 0),
      billingResults: result.results
    });
  } catch (error) {
    console.error('❌ Error processing missed call billing:', error);
    res.status(500).json({ error: 'Failed to process missed call billing' });
  }
});

billingRouter.post('/missed-calls/complete-cycle', async (req, res) => {
  try {
    console.log('🔄 Starting complete billing cycle (billing + notifications)...');
    
    const { MissedCallBillingService } = await import('./missed-call-billing-service');
    await MissedCallBillingService.processCompleteBillingCycle();
    
    console.log('✅ Complete billing cycle finished successfully');
    res.json({
      success: true,
      message: 'Complete billing cycle processed (billing + notifications generated but not sent)'
    });
  } catch (error) {
    console.error('❌ Error in complete billing cycle:', error);
    res.status(500).json({ error: 'Failed to process complete billing cycle' });
  }
});

// MGA Performance Report Endpoints
billingRouter.get('/mga-performance-reports', async (req, res) => {
  try {
    console.log('📊 Generating MGA performance reports...');
    
    const { MissedCallBillingService } = await import('./missed-call-billing-service');
    const reports = await MissedCallBillingService.generateMGAReports();
    
    console.log('✅ MGA performance reports generated successfully');
    res.json({
      success: true,
      totalMGAs: reports.length,
      reports: reports,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating MGA performance reports:', error);
    res.status(500).json({ error: 'Failed to generate MGA performance reports' });
  }
});

billingRouter.post('/mga-performance-reports/send', async (req, res) => {
  try {
    console.log('📊 Generating and preparing MGA performance report emails...');
    
    const { MissedCallBillingService } = await import('./missed-call-billing-service');
    const reports = await MissedCallBillingService.generateMGAReports();
    await MissedCallBillingService.generateMGAReportNotifications(reports);
    
    console.log('✅ MGA performance report emails prepared (not sent)');
    res.json({
      success: true,
      message: 'MGA performance report emails generated (not sent)',
      totalReports: reports.length
    });
  } catch (error) {
    console.error('❌ Error preparing MGA performance report emails:', error);
    res.status(500).json({ error: 'Failed to prepare MGA performance report emails' });
  }
});

// Individual Agent Missed Call Charges
billingRouter.get('/missed-calls/agent/:agentEmail', async (req, res) => {
  try {
    const { agentEmail } = req.params;
    console.log(`💰 Getting missed call charges for agent: ${agentEmail}`);
    
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('user_credits')
      .select('missed_calls, aoi_missed_calls, email, name')
      .eq('email', agentEmail)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      agentEmail,
      missedCallCharges: data?.missed_calls || 0,
      missedCallCount: data?.aoi_missed_calls || 0,
      agentName: data?.name || 'Unknown',
      chargePerMissedCall: 4.00
    });
  } catch (error) {
    console.error('❌ Error getting agent missed call charges:', error);
    res.status(500).json({ error: 'Failed to get agent missed call charges' });
  }
});

// All Agents Missed Call Summary  
billingRouter.get('/missed-calls/all-agents', async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;
    console.log(`💰 Getting missed call charges for user: ${userEmail}`);
    
    
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('user_credits')
      .select('missed_calls, aoi_missed_calls, email, name')
      .gt('missed_calls', 0);
    
    if (error) throw error;
    
    const agentCharges = data?.map(agent => ({
      agentEmail: agent.email,
      agentName: agent.name || 'Unknown',
      missedCallCharges: agent.missed_calls || 0,
      missedCallCount: agent.aoi_missed_calls || 0,
      chargePerMissedCall: 4.00
    })) || [];
    
    const totalCharges = agentCharges.reduce((sum, agent) => sum + agent.missedCallCharges, 0);
    const totalMissedCalls = agentCharges.reduce((sum, agent) => sum + agent.missedCallCount, 0);
    
    res.json({
      success: true,
      totalAgentsWithCharges: agentCharges.length,
      totalMissedCallCharges: totalCharges,
      totalMissedCalls: totalMissedCalls,
      chargePerMissedCall: 4.00,
      agents: agentCharges.sort((a, b) => b.missedCallCharges - a.missedCallCharges)
    });
  } catch (error) {
    console.error('❌ Error getting all agents missed call charges:', error);
    res.status(500).json({ error: 'Failed to get all agents missed call charges' });
  }
});

// Email Preview Endpoints - for testing and preview purposes
billingRouter.get('/email-preview/missed-call', async (req, res) => {
  try {
    const { EmailTemplates } = await import('./email');
    
    // Sample data for missed call notification
    const sampleData = {
      agentName: 'Sample Agent',
      missedCallCount: 1,
      billingAmount: 4.00,
      phone: '+1 (555) 123-4567',
      leadName: 'John Smith',
      date: new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };
    
    const html = EmailTemplates.missedCallBilling.getHtml(sampleData);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('❌ Error generating missed call email preview:', error);
    res.status(500).json({ error: 'Failed to generate email preview' });
  }
});

billingRouter.get('/email-preview/mga-report', async (req, res) => {
  try {
    const { EmailTemplates } = await import('./email');
    
    // Sample data for MGA performance report
    const sampleData = {
      mgaName: 'Elite Sales MGA',
      totalConnects: 156,
      totalBilling: 1248.00,
      topAgents: [
        { name: 'Sarah Johnson', connects: 45, billing: 360.00 },
        { name: 'Mike Rodriguez', connects: 38, billing: 304.00 },
        { name: 'Lisa Chen', connects: 31, billing: 248.00 },
        { name: 'David Wilson', connects: 24, billing: 192.00 },
        { name: 'Amy Davis', connects: 18, billing: 144.00 }
      ],
      period: 'Week of ' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric' 
      }) + ' - ' + new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    };
    
    const html = EmailTemplates.mgaPerformanceReport.getHtml(sampleData);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('❌ Error generating MGA report email preview:', error);
    res.status(500).json({ error: 'Failed to generate email preview' });
  }
});

// SMS/Text notification preview
billingRouter.get('/sms-preview/missed-call', async (req, res) => {
  try {
    const sampleData = {
      agentName: 'Sample Agent',
      missedCallCount: 1,
      billingAmount: 4.00,
      phone: '+1 (555) 123-4567'
    };
    
    const smsText = `🔔 AO Intelligence Alert

Hi ${sampleData.agentName},

$4.00 has been deducted from your available credits for 1 missed call.

Phone: ${sampleData.phone}
Credit deduction: $4.00 per missed call

📋 GOOD NEWS: This lead has been transferred to your intown box in Planet for follow-up. Check your Planet dashboard to continue the sales process.

💡 Tip: Answer calls promptly to avoid deductions!

View details: https://aoirail-production-baa2.up.railway.app/dashboard/aoi/billing

Questions? Reply STOP to opt-out.`;
    
    res.json({
      type: 'SMS/Text Message',
      to: '+1 (555) 987-6543', // Agent's phone number
      message: smsText,
      length: smsText.length,
      estimatedCost: '$0.02'
    });
  } catch (error) {
    console.error('❌ Error generating SMS preview:', error);
    res.status(500).json({ error: 'Failed to generate SMS preview' });
  }
});

// In-system notification preview
billingRouter.get('/notification-preview/missed-call', async (req, res) => {
  try {
    const sampleData = {
      agentName: 'Sample Agent',
      missedCallCount: 1,
      billingAmount: 4.00,
      phone: '+1 (555) 123-4567',
      leadName: 'John Smith'
    };
    
    const notification = {
      type: 'CREDIT_DEDUCTION_ALERT',
      title: 'Credit Deduction & Lead Transfer',
      message: `$4.00 has been deducted from your available credits for 1 missed call (${sampleData.phone}). This lead has been transferred to your intown box in Planet for follow-up.`,
      severity: 'warning', // info, warning, error
      timestamp: new Date().toISOString(),
      actions: [
        {
          label: 'View Credits',
          url: '/dashboard/aoi/billing'
        },
        {
          label: 'Open Planet Dashboard',
          url: 'https://planet.aoglobelife.com'
        },
        {
          label: 'Dispute Deduction',
          url: '/support/billing-dispute'
        }
      ],
      metadata: {
        agentId: '1253',
        billingAmount: 4.00,
        missedCallCount: 1,
        phone: sampleData.phone,
        leadName: sampleData.leadName,
        leadTransferred: true,
        transferLocation: 'intown box',
        transferSystem: 'Planet'
      }
    };
    
    res.json(notification);
  } catch (error) {
    console.error('❌ Error generating notification preview:', error);
    res.status(500).json({ error: 'Failed to generate notification preview' });
  }
});

// Send all missed leads back to their respective agents via Planet ALTIG webhook
billingRouter.post('/send-missed-leads', async (req, res) => {
  try {
    console.log('🚨 Starting missed lead redistribution process...');
    
    const { RealBillingService } = await import('./real-billing-service');
    const result = await RealBillingService.sendMissedLeadsToAgents();
    
    res.json({
      success: true,
      message: `Missed lead redistribution complete: ${result.success} success, ${result.failed} failed`,
      data: result
    });
  } catch (error) {
    console.error('❌ Error in missed lead redistribution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get missed call transactions for a user (shown as positive credits in ledger)
billingRouter.get('/missed-call-transactions', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    const { supabaseAdmin } = await import('./supabase');
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    // Get missed_call charges
    const { data: missedCallTransactions, error: missedCallError } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .eq('agent_email', email)
      .order('transaction_date', { ascending: false });

    if (missedCallError) {
      console.error('❌ Error fetching missed call transactions:', missedCallError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Get related refunds
    const missedCallIds = missedCallTransactions?.map(t => t.transaction_id) || [];
    const { data: refunds } = missedCallIds.length > 0 ? await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'refund')
      .eq('agent_email', email)
      .in('source_id', missedCallIds)
      .order('transaction_date', { ascending: false }) : { data: [] };

    // Combine and sort by date
    const allTransactions = [
      ...(missedCallTransactions || []),
      ...(refunds || [])
    ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

    // Add note to missed_call transactions
    const transactionsWithNote = allTransactions.map(t => ({
      ...t,
      reversal_note: t.transaction_type === 'missed_call' 
        ? 'This charge was incorrectly applied.' 
        : undefined,
    }));

    res.json({
      success: true,
      transactions: transactionsWithNote,
    });
  } catch (error: any) {
    console.error('❌ Error in missed-call-transactions endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch missed call transactions' });
  }
});

// Update user_credits table with missed call billing from CSV analysis
billingRouter.post('/update-missed-call-billing', async (req, res) => {
  try {
    console.log('💳 Starting missed call billing update...');
    
    const { RealBillingService } = await import('./real-billing-service');
    const result = await RealBillingService.updateMissedCallBilling();
    
    res.json({
      success: true,
      message: `Missed call billing update complete: ${result.success} agents billed, ${result.failed} failed`,
      data: result
    });
  } catch (error) {
    console.error('❌ Error in missed call billing update:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send MGA billing report to specific MGA email
billingRouter.post('/send-mga-report/:mgaName', async (req, res) => {
  try {
    const { mgaName } = req.params;
    const { recipientEmail } = req.body;
    console.log(`📧 Sending MGA billing report for: ${mgaName}`);
    
    const { RealBillingService } = await import('./real-billing-service');
    const { sendEmail } = await import('./email');
    
    // Get the MGA hierarchy data
    const hierarchyData = await RealBillingService.generateMGAHierarchyBreakdown();
    
    // Find the specific MGA team
    const mgaTeam = hierarchyData.find(team => 
      team.mgaName.toLowerCase().includes(mgaName.toLowerCase()) ||
      mgaName.toLowerCase().includes(team.mgaName.toLowerCase())
    );
    
    if (!mgaTeam) {
      return res.status(404).json({
        success: false,
        error: `MGA team not found for: ${mgaName}`
      });
    }
    
    // Use provided email or determine based on MGA name
    let mgaEmail = recipientEmail || '';
    if (!mgaEmail) {
      if (mgaName.toLowerCase().includes('chris') || mgaName.toLowerCase().includes('lafond')) {
        mgaEmail = 'chrislafond@aoglobelife.com';
      } else if (mgaName.toLowerCase().includes('christian') || mgaName.toLowerCase().includes('gojaj')) {
        mgaEmail = 'christiangojaj@aoglobelife.com';
      } else {
        // Default fallback - could be enhanced with a lookup table
        mgaEmail = `${mgaName.toLowerCase().replace(/\s+/g, '')}@aoglobelife.com`;
      }
    }
    
    // Generate professional HTML email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #f8f9fa;">
        <div style="background: #1a365d; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">AO Intelligence</h1>
          <h2 style="margin: 10px 0 0 0; font-weight: normal; font-size: 18px;">MGA Billing Report</h2>
        </div>
        
        <div style="padding: 40px; background: white;">
          <h2 style="color: #1a365d; margin: 0 0 25px 0; font-size: 24px;">📊 ${mgaTeam.mgaName} Performance Report</h2>
          
          <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #2e7d32; margin: 0 0 20px 0; font-size: 20px;">💰 Team Summary</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Revenue:</td><td style="padding: 8px 0; color: #2e7d32; font-weight: bold;">$${mgaTeam.totalBilling.toLocaleString()}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Connects:</td><td style="padding: 8px 0;">${mgaTeam.totalConnects}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Total Missed Calls:</td><td style="padding: 8px 0; color: #d32f2f;">${mgaTeam.totalMissedCalls}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Active Agents:</td><td style="padding: 8px 0;">${mgaTeam.agents.length}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Avg per Agent:</td><td style="padding: 8px 0;">$${Math.round(mgaTeam.totalBilling / mgaTeam.agents.length)}</td></tr>
            </table>
          </div>
          
          <h3 style="color: #1a365d; margin: 30px 0 20px 0; font-size: 20px;">👥 Individual Agent Performance</h3>
          
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
            ${mgaTeam.agents.map(agent => `
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 18px; color: #1a365d;">${agent.agentName}</h4>
                    <p style="margin: 0; color: #666; font-size: 14px;">${agent.agentEmail}</p>
                    ${agent.associateId !== 'N/A' ? `<p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Associate ID: ${agent.associateId}</p>` : ''}
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 24px; font-weight: bold; color: #2e7d32; margin-bottom: 5px;">$${agent.billing.toLocaleString()}</div>
                    <div style="font-size: 14px; color: #666;">${agent.connects} connects • ${agent.missedCalls} missed</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <h4 style="color: #856404; margin: 0 0 15px 0;">📈 Billing Details</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>AO Connects are billed at $8.00 each</li>
              <li>Missed calls are charged at $4.00 each</li>
              <li>Report generated: ${new Date().toLocaleString()}</li>
              <li>All amounts reflect real-time billing data</li>
            </ul>
          </div>
        </div>
        
        <div style="background: #718096; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">AO Intelligence | MGA Billing System</p>
          <p style="margin: 10px 0 0 0; font-size: 12px;">This report contains confidential billing information.</p>
        </div>
      </div>
    `;
    
    // Send the email
    const emailSent = await sendEmail({
      to: mgaEmail,
      subject: `AO Intelligence - ${mgaTeam.mgaName} Billing Report (${new Date().toLocaleDateString()})`,
      html: emailHtml,
      text: `MGA Billing Report for ${mgaTeam.mgaName}: $${mgaTeam.totalBilling} total revenue, ${mgaTeam.totalConnects} connects, ${mgaTeam.agents.length} agents.`
    });
    
    console.log(`✅ MGA billing report sent to ${mgaEmail} for ${mgaTeam.mgaName}`);
    
    res.json({
      success: true,
      message: `MGA billing report sent successfully to ${mgaEmail}`,
      mgaName: mgaTeam.mgaName,
      mgaEmail: mgaEmail,
      totalRevenue: mgaTeam.totalBilling,
      totalAgents: mgaTeam.agents.length,
      emailSent: emailSent
    });
  } catch (error) {
    console.error('❌ Error sending MGA billing report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send MGA billing report'
    });
  }
});

// CRITICAL: Sync real CSV billing data to individual agent dashboards
billingRouter.post('/sync-agent-dashboards', async (req, res) => {
  try {
    console.log('🔥 MANUAL TRIGGER: Syncing real CSV billing data to agent dashboards...');
    
    const { RealBillingService } = await import('./real-billing-service');
    
    // Update all agent dashboards with real CSV billing data
    await RealBillingService.updateAgentDashboardBilling();
    
    res.json({
      success: true,
      message: 'Agent dashboard billing sync completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error syncing agent dashboard billing:', error);
    res.status(500).json({ 
      error: 'Failed to sync agent dashboard billing',
      details: error.message 
    });
  }
});

// Get real agent billing data for individual dashboard
billingRouter.get('/agent-billing/:associateId', async (req, res) => {
  try {
    const { associateId } = req.params;
    console.log(`💰 Getting real billing data for agent ID: ${associateId}`);
    
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('associate_id', parseInt(associateId))
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Agent billing data not found' });
      }
      throw error;
    }
    
    // Format the response with real billing data
    const billingData = {
      agentName: data.name || 'Unknown Agent',
      agentEmail: data.email || 'Unknown Email',
      associateId: data.associate_id,
      
      // Real AO Connect billing from CSV
      aoConnects: data.aoi_connect_credits_used || 0,
      aoConnectBilling: data.aoi_connect_billing || 0,
      
      // Real missed call billing from CSV  
      missedCalls: data.aoi_missed_calls || 0,
      missedCallBilling: data.missed_calls || 0,
      
      // Total billing
      totalBilling: (data.aoi_connect_billing || 0) + (data.missed_calls || 0),
      
      // Timestamps
      lastUpdated: data.updated_at,
      created: data.created_at
    };
    
    res.json({
      success: true,
      data: billingData
    });
    
  } catch (error) {
    console.error('❌ Error getting agent billing data:', error);
    res.status(500).json({ 
      error: 'Failed to get agent billing data',
      details: error.message 
    });
  }
});

// ================================
// NOTIFICATION MANAGEMENT ENDPOINTS
// ================================

// Get notification statistics
billingRouter.get('/notifications/stats', async (req, res) => {
  try {
    const stats = await MissedCallNotificationService.getNotificationStats();
    const schedulerStatus = NotificationScheduler.getStatus();
    
    res.json({
      success: true,
      notifications: stats,
      scheduler: schedulerStatus
    });
  } catch (error) {
    console.error('❌ Error getting notification stats:', error);
    res.status(500).json({ error: 'Failed to get notification statistics' });
  }
});

// Process notifications manually (for testing)
billingRouter.post('/notifications/process', async (req, res) => {
  try {
    const results = await MissedCallNotificationService.processPendingNotifications();
    
    res.json({
      success: true,
      message: 'Notification processing completed',
      results
    });
  } catch (error) {
    console.error('❌ Error processing notifications:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
});

// Create a missed call notification record
billingRouter.post('/notifications/missed-call', async (req, res) => {
  try {
    const { agent_id, agent_name, agent_email, phone, lead_name, date, time, credit_deduction } = req.body;
    
    if (!agent_id || !agent_name || !agent_email || !phone || !date || !time || !credit_deduction) {
      return res.status(400).json({ 
        error: 'Missing required fields: agent_id, agent_name, agent_email, phone, date, time, credit_deduction' 
      });
    }

    const notificationId = await MissedCallNotificationService.createMissedCallNotification({
      agent_id,
      agent_name,
      agent_email,
      phone,
      lead_name,
      date,
      time,
      credit_deduction
    });

    if (notificationId) {
      res.json({
        success: true,
        message: 'Missed call notification created',
        notificationId
      });
    } else {
      res.status(500).json({ error: 'Failed to create notification record' });
    }
  } catch (error) {
    console.error('❌ Error creating missed call notification:', error);
    res.status(500).json({ error: 'Failed to create missed call notification' });
  }
});

// Trigger notification scheduler manually
billingRouter.post('/notifications/trigger', async (req, res) => {
  try {
    await NotificationScheduler.runNow();
    
    res.json({
      success: true,
      message: 'Notification scheduler triggered manually'
    });
  } catch (error) {
    console.error('❌ Error triggering notification scheduler:', error);
    res.status(500).json({ error: 'Failed to trigger notification scheduler' });
  }
});

// Missed call notification scheduler routes
billingRouter.get('/scheduler/status', async (req, res) => {
  try {
    const { missedCallNotificationScheduler } = await import("./missed-call-notification-scheduler");
    const status = missedCallNotificationScheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('❌ Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

billingRouter.post('/scheduler/trigger', async (req, res) => {
  try {
    const { missedCallNotificationScheduler } = await import("./missed-call-notification-scheduler");
    await missedCallNotificationScheduler.triggerManualCheck();
    res.json({ success: true, message: 'Manual check triggered successfully' });
  } catch (error) {
    console.error('❌ Error triggering manual check:', error);
    res.status(500).json({ error: 'Failed to trigger manual check' });
  }
});

// Get all charges for a user within a date range
billingRouter.get('/all-charges/:dateRange?', async (req, res) => {
  try {
    const userEmail = req.query.userEmail as string;
    const dateRange = req.params.dateRange || 'last7days';
    console.log(`🔥 INDIVIDUAL BILLING API HIT - user: ${userEmail}, range: ${dateRange}`);
    
    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }
    
    const { supabaseAdmin } = await import('./supabase');
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database connection unavailable' });
    }
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'last7days':
        startDate = subDays(now, 7);
        break;
      case 'last30days':
        startDate = subDays(now, 30);
        break;
      case 'thisweek':
        startDate = startOfWeek(now);
        break;
      case 'thismonth':
        startDate = startOfMonth(now);
        break;
      case 'lastmonth':
        startDate = startOfMonth(subDays(now, 30));
        break;
      default:
        startDate = subDays(now, 7);
    }
    
    const startDateStr = startDate.toISOString();
    
    console.log(`📅 Date range: ${startDateStr} to now`);
    
    // Query billing_transactions table directly
    const { data: transactions, error: txnError } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', userEmail.toLowerCase())
      .gte('transaction_date', startDateStr)
      .order('transaction_date', { ascending: false });
    
    if (txnError) {
      console.error('❌ Error fetching billing transactions:', txnError);
      return res.status(500).json({ error: 'Failed to fetch billing transactions' });
    }
    
    console.log(`✅ Found ${transactions?.length || 0} billing transactions for ${userEmail}`);
    
    // Transform transactions to billing call format
    const allCalls = (transactions || []).map(txn => {
      const typeMap: Record<string, { type: string; icon: string; color: string }> = {
        'precheck': { type: 'AOI_PRECHECK', icon: '🛡️', color: 'purple' },
        'recruit': { type: 'AOI_RECRUIT', icon: '👥', color: 'green' },
        'connect': { type: 'AOI_CONNECT', icon: '📱', color: 'blue' },
        'missed_call': { type: 'AOI_MISSED', icon: '📞', color: 'red' },
        'purchase': { type: 'PURCHASE', icon: '💳', color: 'green' }
      };
      
      const config = typeMap[txn.transaction_type] || { type: 'UNKNOWN', icon: '❓', color: 'gray' };
      
      return {
        id: txn.transaction_id || txn.id,
        type: config.type,
        phone: txn.lead_phone || 'N/A',
        leadName: txn.lead_name || 'Unknown',
        agentId: txn.agent_associate_id || userEmail.split('@')[0],
        agentName: txn.agent_name || userEmail.split('@')[0],
        billingAmount: txn.amount_usd || 0,
        creditsDeducted: txn.credits_charged || 0,
        callAttempts: [],
        finalStatus: 'COMPLETED',
        chargedAt: new Date(txn.transaction_date).toLocaleDateString(),
        transactionDate: txn.transaction_date,
        icon: config.icon,
        color: config.color
      };
    });
    
    const totalCalls = allCalls.length;
    const totalCharges = allCalls.reduce((sum, call) => sum + (call.billingAmount || 0), 0);
    const totalCreditsUsed = allCalls.filter(c => c.creditsDeducted > 0).reduce((sum, call) => sum + call.creditsDeducted, 0);
    
    // Get remaining credits from user_credit table
    let remainingCredits = 0;
    const { data: creditData } = await supabaseAdmin
      .from('user_credit')
      .select('credits_remaining')
      .eq('email', userEmail.toLowerCase())
      .maybeSingle();
    
    if (creditData) {
      remainingCredits = creditData.credits_remaining || 0;
    }
    
    console.log(`💳 Credits for ${userEmail}: Used=${totalCreditsUsed}, Remaining=${remainingCredits}`);
    
    // Separate calls by type for tabs
    const precheckCalls = allCalls.filter(c => c.type === 'AOI_PRECHECK');
    const recruitCalls = allCalls.filter(c => c.type === 'AOI_RECRUIT');
    const connectCalls = allCalls.filter(c => c.type === 'AOI_CONNECT');
    const missedCalls = allCalls.filter(c => c.type === 'AOI_MISSED');
    const purchaseCalls = allCalls.filter(c => c.type === 'PURCHASE');
    
    res.json({
      success: true,
      totalCalls,
      totalCharges,
      totalCreditsUsed,
      totalCreditsEarned: 0,
      remainingCredits,
      calls: allCalls,
      precheckCalls,
      recruitCalls,
      connectCalls,
      missedCalls,
      purchaseCalls,
      dateRange: req.params.dateRange || 'last7days'
    });
    
  } catch (error) {
    console.error('❌ Error in billing API:', error);
    res.status(500).json({ error: 'Failed to fetch billing data' });
  }
});
