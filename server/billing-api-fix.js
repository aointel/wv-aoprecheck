// Temporary fix for billing API - replace demo data with real CSV data
const fs = require('fs');

function createBillingRoute(app) {
  app.get('/api/billing/all-charges/:dateRange?', async (req, res) => {
    try {
      console.log('🔥 BILLING API HIT - returning real MGA billing data');
      
      // Load real CSV data from processed MGA billing report
      let realData = {};
      try {
        const mgaBillingReport = JSON.parse(fs.readFileSync('server/uploads/mga_billing_report.json', 'utf8'));
        
        // Transform real data into billing format
        const aoiConnectCalls = [];
        const missedCalls = [];
        
        mgaBillingReport.rawCalls.forEach((call, index) => {
          if (call.callType === 'AOI_CONNECT') {
            const pickupEvent = call.events.find(e => e.event === 'PICK_UP' || e.event === 'PICKED');
            const endEvent = call.events.find(e => e.event === 'END');
            
            aoiConnectCalls.push({
              id: `real_connect_${index}`,
              type: 'AOI_CONNECT',
              phone: call.phone,
              leadName: call.leadName || `Lead ${call.phone.slice(-4)}`,
              agentId: call.agentId,
              agentName: `Agent ${call.agentId}`,
              billingAmount: 8.00,
              callAttempts: [
                { cycle: 1, timestamp: call.date + ' ' + (pickupEvent?.time?.replace(/"/g, '') || ''), event: 'PICK_UP', duration: '180s' },
                { cycle: 1, timestamp: call.date + ' ' + (endEvent?.time?.replace(/"/g, '') || ''), event: 'END', duration: '180s' }
              ],
              finalStatus: 'CONNECTED',
              chargedAt: call.date + ' ' + (endEvent?.time?.replace(/"/g, '') || ''),
              icon: '✅',
              color: 'green'
            });
          } else if (call.callType === 'AOI_MISSED') {
            const missedEvent = call.events.find(e => e.event === 'MISSED');
            
            missedCalls.push({
              id: `real_missed_${index}`,
              type: 'AOI_MISSED', 
              phone: call.phone,
              leadName: call.leadName || `Lead ${call.phone.slice(-4)}`,
              agentId: call.agentId || 'N/A',
              agentName: `Agent ${call.agentId || 'N/A'}`,
              billingAmount: 4.00,
              callAttempts: [
                { cycle: 1, timestamp: call.date + ' ' + (missedEvent?.time?.replace(/"/g, '') || ''), event: 'NO_ANSWER', duration: '0s' }
              ],
              finalStatus: 'MISSED',
              chargedAt: call.date + ' ' + (missedEvent?.time?.replace(/"/g, '') || ''),
              icon: '📞',
              color: 'red'
            });
          }
        });
        
        realData = {
          aoiConnectCalls,
          missedCalls,
          hotleadCalls: [], 
          recruitCalls: [],
          precheckCalls: [],
          recruitMissedCalls: []
        };
      } catch (fileError) {
        console.error('❌ Error loading MGA billing report:', fileError);
        realData = {
          aoiConnectCalls: [],
          missedCalls: [],
          hotleadCalls: [],
          recruitCalls: [],
          precheckCalls: [],
          recruitMissedCalls: []
        };
      }
      
      // Calculate totals from real data
      const allCalls = [
        ...realData.aoiConnectCalls,
        ...realData.missedCalls,
        ...realData.hotleadCalls,
        ...realData.recruitCalls,
        ...realData.precheckCalls,
        ...realData.recruitMissedCalls
      ];
      
      const totalCalls = allCalls.length;
      const totalCharges = allCalls.reduce((sum, call) => sum + call.billingAmount, 0);
      
      const billingBreakdown = {
        aoiConnect: {
          count: realData.aoiConnectCalls.length,
          totalAmount: realData.aoiConnectCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 8.00
        },
        aoiMissed: {
          count: realData.missedCalls.length,
          totalAmount: realData.missedCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 4.00
        },
        hotConnects: {
          count: realData.hotleadCalls.length,
          totalAmount: realData.hotleadCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 2.00
        },
        aoiRecruit: {
          count: realData.recruitCalls.length,
          totalAmount: realData.recruitCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 5.00
        },
        aoiPrecheck: {
          count: realData.precheckCalls.length,
          totalAmount: realData.precheckCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 4.00
        },
        recruitMissed: {
          count: realData.recruitMissedCalls.length,
          totalAmount: realData.recruitMissedCalls.reduce((sum, call) => sum + call.billingAmount, 0),
          rate: 4.00
        }
      };
      
      console.log(`✅ Returning real billing data: ${totalCalls} calls, $${totalCharges} total charges`);
      
      res.json({
        success: true,
        totalCalls,
        totalCharges,
        billingBreakdown,
        calls: allCalls,
        ...realData,
        agentName: 'Real MGA Billing Data',
        agentId: 'MGA_SYSTEM', 
        dateRange: req.params.dateRange || 'last7days'
      });
      
    } catch (error) {
      console.error('❌ Error in billing API:', error);
      res.status(500).json({ error: 'Failed to fetch billing data' });
    }
  });
}

module.exports = { createBillingRoute };