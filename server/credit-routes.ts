import express, { type Express } from "express";
import { creditService } from "./credit-service";
import { z } from "zod";
import { db } from "./db";
import * as schema from "../shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { supabase, supabaseAdmin } from "./supabase";

// Validation schemas
const addCreditsSchema = z.object({
  agentId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
  paymentMethod: z.string().optional().default("admin"),
  paymentId: z.string().optional(),
});

const deductCreditsSchema = z.object({
  agentId: z.string().min(1),
  vdpConnectId: z.number().positive(),
  phoneNumber: z.string().min(1),
  clientName: z.string().min(1),
  connectDuration: z.number().positive(),
  market: z.string().min(1),
});

const agentIdSchema = z.object({
  agentId: z.string().min(1),
});

export function registerCreditRoutes(app: Express) {

  // Test endpoint to trigger billing notification
  app.post("/api/credit/test-notification", async (req, res) => {
    try {
      const { agentId, serviceType, amount, clientName, phoneNumber } = req.body;

      // Default test values
      const testAgentId = agentId || "409";
      const testServiceType = serviceType || "aoi_connect";
      const testAmount = amount || 8.00;
      const testClientName = clientName || "Test Client";
      const testPhoneNumber = phoneNumber || "+15551234567";
      const testBalance = 42.00; // Mock balance after billing

      // Send test notification
      creditService.sendBillingNotification(
        testAgentId,
        testServiceType,
        testAmount,
        testBalance,
        testClientName,
        testPhoneNumber
      );

      res.json({
        success: true,
        message: "Test billing notification sent",
        data: {
          agentId: testAgentId,
          serviceType: testServiceType,
          amount: testAmount,
          newBalance: testBalance,
          clientName: testClientName,
          phoneNumber: testPhoneNumber
        }
      });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  // Test endpoint to test different service type billing rates
  app.post("/api/credit/test-billing-rates", async (req, res) => {
    try {
      console.log("🧪 Testing different billing rates...");

      // Initialize a test agent with some credits
      const testAgentId = "999999"; // Use a test agent ID
      await creditService.initializeAgentCredits(testAgentId);

      // Add sufficient credits for testing all service types
      await creditService.addCredits(
        testAgentId,
        100.00,
        "Test credits for billing rates",
        "admin",
        "test-billing-001"
      );

      // Test all service types
      const testResults = [];

      // Test AOI Connect ($8.00)
      const connectResult = await creditService.deductCreditsForConnect(
        1001, testAgentId, "+15551234567", "Test Client 1", 30, "Test Market", "aoi_connect"
      );
      testResults.push({ serviceType: "aoi_connect", rate: "$8.00", result: connectResult });

      // Test AOI Missed Call ($4.00)
      const missedResult = await creditService.deductCreditsForConnect(
        1002, testAgentId, "+15551234568", "Test Client 2", 5, "Test Market", "aoi_missed"
      );
      testResults.push({ serviceType: "aoi_missed", rate: "$4.00", result: missedResult });

      // Test AOI Recruit ($5.00)
      const recruitResult = await creditService.deductCreditsForConnect(
        1003, testAgentId, "+15551234569", "Test Client 3", 45, "Test Market", "aoi_recruit"
      );
      testResults.push({ serviceType: "aoi_recruit", rate: "$5.00", result: recruitResult });

      // Test AOI PreCheck ($3.00)
      const precheckResult = await creditService.deductCreditsForConnect(
        1004, testAgentId, "+15551234570", "Test Client 4", 15, "Test Market", "aoi_precheck"
      );
      testResults.push({ serviceType: "aoi_precheck", rate: "$3.00", result: precheckResult });

      // Get final agent info
      const finalAgentInfo = await creditService.getAgentCreditInfo(testAgentId);

      res.json({
        success: true,
        message: "Billing rates test completed",
        data: {
          testResults,
          finalAgentInfo,
          totalDeducted: "$20.00" // $8 + $4 + $5 + $3
        }
      });

    } catch (error) {
      console.error("❌ Error testing billing rates:", error);
      res.status(500).json({
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get comprehensive agent billing dashboard data with AOI connects from VDP
  app.get("/api/agent-billing/:agentId", async (req, res) => {
    try {
      let { agentId } = agentIdSchema.parse(req.params);
      const { filter, startDate, endDate } = req.query as Record<string, string>;

      // Handle email format - extract associate ID from email parameter
      if (agentId.includes('@') || agentId.startsWith('email:')) {
        const email = agentId.replace('email:', '');
        console.log(`🔍 Converting email ${email} to associate ID...`);

        // Get associate ID from Supabase customers table - handle duplicates by preferring records with associate_id
        const { data: users, error: lookupError } = await supabase
          .from('customers')
          .select('associate_id, first_name, last_name')
          .eq('company_email', email)
          .not('associate_id', 'is', null) // Prefer records with associate_id
          .order('associate_id', { ascending: true }) // Consistent ordering
          .limit(1);
        
        const user = users && users.length > 0 ? users[0] : null;

        console.log(`🔍 DEBUG: Customers table lookup for ${email}:`, { user, error: lookupError });

        if (user?.associate_id) {
          agentId = user.associate_id.toString();
          console.log(`✅ Found associate ID: ${agentId} for email: ${email} (${user.first_name} ${user.last_name})`);
        } else {
          console.error(`❌ No associate ID found for email: ${email} in customers table`);
          console.error(`❌ Lookup error:`, lookupError);

          // Try alternative lookup in case email format differs
          const { data: altUser } = await supabase
            .from('customers')
            .select('associate_id, first_name, last_name, company_email')
            .ilike('company_email', `%${email.split('@')[0]}%`)
            .limit(5);

          if (altUser && altUser.length > 0) {
            console.log(`🔍 Alternative email matches found:`, altUser);
          }

          return res.status(404).json({ error: "Agent not found" });
        }
      }

      console.log(`🔍 Getting AOI billing data for agent: ${agentId} (filter: ${filter}, ${startDate} to ${endDate})`);

      // Get credit info
      const creditInfo = await creditService.getAgentCreditInfo(agentId);

      // Build date filter conditions
      let aoiConnectsQuery = db.select()
        .from(schema.aoiConnects)
        .where(eq(schema.aoiConnects.agentId, agentId));

      console.log(`🔍 Querying AOI connects for agentId: ${agentId}`);

      // Calculate date range for filtering
      let startDateTime = '';
      let endDateTime = '';
      
      if (filter === 'today') {
        // Use local timezone to get the correct "today" date
        const now = new Date();
        const today = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)); // Adjust for timezone
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        
        startDateTime = `${year}-${month}-${day}T00:00:00`;
        endDateTime = `${year}-${month}-${day}T23:59:59`;
        console.log(`🔍 APPLYING TODAY FILTER: ${startDateTime} to ${endDateTime}`);
      } else if (filter === 'last7days') {
        const today = new Date();
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        startDateTime = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}T00:00:00`;
        endDateTime = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}T23:59:59`;
        console.log(`🔍 APPLYING 7-DAY FILTER: ${startDateTime} to ${endDateTime}`);
      } else {
        console.log(`🔍 NO DATE FILTER APPLIED - getting ALL records for agent: ${agentId}`);
      }

      // Query VDP calls with proper date filtering
      console.log(`🔍 Querying VDP calls for Agent: ${agentId}`);

      let aoiConnectsRaw: any[] = [];
      let missedCallsFormatted: any[] = [];

      if (supabase) {
        try {
          let vdpQuery = supabase
            .from('vdp_calls')
            .select('*')
            .eq('agent', agentId);

          // Apply date filtering if specified
          if (startDateTime && endDateTime) {
            vdpQuery = vdpQuery
              .gte('time', startDateTime)
              .lte('time', endDateTime);
            console.log(`🔍 VDP CALLS: Applying date filter ${startDateTime} to ${endDateTime}`);
          }

          const { data: vdpCalls, error } = await vdpQuery.order('id', { ascending: false });

          if (error) {
            console.error('❌ Error querying VDP calls:', error);
          } else {
            console.log(`📊 FOUND ${vdpCalls?.length || 0} VDP calls for Agent ${agentId}`);

            if (vdpCalls && vdpCalls.length > 0) {
              console.log(`🔥 SAMPLE RECORDS:`, vdpCalls.slice(0, 3).map(call => ({
                id: call.id,
                time: call.time,
                phone: call.phone,
                agent: call.agent,
                firstName: call.firstName,
                lastName: call.lastName,
                leadid: call.leadid,
                market: call.market
              })));
            }

            // Transform VDP calls to AOI connect format
            aoiConnectsRaw = (vdpCalls || []).map((call) => {
              const clientName = call.firstName && call.lastName
                ? `${call.firstName} ${call.lastName}`.trim()
                : `Client ${call.phone || call.id}`;

              return {
                id: call.leadid || call.id,
                agentId: call.agent,
                clientPhone: call.phone || 'N/A',
                clientName: clientName,
                firstName: call.firstName,
                lastName: call.lastName,
                leadId: call.leadid,
                market: call.market || 'Veteran',
                callDate: call.time ? call.time.split('T')[0] || call.time.split(' ')[0] : new Date().toISOString().split('T')[0],
                callTime: call.time ? (call.time.split('T')[1] || '00:00:00').split('+')[0] : '00:00:00',
                duration: call.duration || '0',
                billingAmount: "8.00",
                billed: true,
                notified: false
              };
            });

            // NOW QUERY VDP MISSED CALLS FROM SUPABASE (CORRECT TABLE NAME)
            console.log(`🔍 Querying VDP MISSED calls from Supabase for Agent: ${agentId}`);
            let allMissedCalls = [];
            
            try {
              // Query the correct Supabase table: vdp_calls_missed
              let missedQuery = supabase
                .from('vdp_calls_missed')
                .select('*')
                .eq('agent', agentId);

              // Apply date filtering if specified
              if (startDateTime && endDateTime) {
                missedQuery = missedQuery
                  .gte('time', startDateTime)
                  .lte('time', endDateTime);
                console.log(`🔍 MISSED CALLS: Applying date filter ${startDateTime} to ${endDateTime}`);
              }

              const { data: missedCallsData, error: missedError } = await missedQuery.order('time', { ascending: false });
              
              if (missedError) {
                console.error('❌ Error querying Supabase VDP missed calls:', { missedError });
              } else {
                allMissedCalls = missedCallsData || [];
                console.log(`✅ SUPABASE: Found ${allMissedCalls.length} VDP missed calls for agent ${agentId}`);
              }
            } catch (error) {
              console.error('❌ Error querying Supabase VDP missed calls:', { error });
            }
            
            if (allMissedCalls && allMissedCalls.length > 0) {
                console.log(`🔥 MISSED CALLS FOUND: ${allMissedCalls.length} total`);
                console.log(`🔥 MISSED CALLS SAMPLE:`, allMissedCalls.slice(0, 3).map(call => ({
                  id: call.id,
                  agent: call.agent,
                  phone: call.phone,
                  firstName: call.firstName || call.firstname,
                  lastName: call.lastName || call.lastname,
                  time: call.time,
                  event: call.event
                })));

                // Add missed calls to the response
                missedCallsFormatted = allMissedCalls.map((call) => ({
                  id: `missed_${call.id}`,
                  agentId: call.agent,
                  clientPhone: call.phone || 'N/A',
                  clientName: call.firstName && call.lastName ?
                    `${call.firstName} ${call.lastName}`.trim() :
                    (call.firstname && call.lastname ? `${call.firstname} ${call.lastname}`.trim() : `Client ${call.phone}`),
                  firstName: call.firstName || call.firstname || '',
                  lastName: call.lastName || call.lastname || '',
                  leadId: call.leadid || `missed_${call.id}`,
                  market: call.market || 'Veteran',
                  callDate: call.time ? call.time.split('T')[0] : new Date().toISOString().split('T')[0],
                  callTime: call.time ? (call.time.split('T')[1] || '00:00:00').split('+')[0] : '00:00:00',
                  duration: '0', // Missed calls have 0 duration
                  billingAmount: "4.00", // Missed calls are $4
                  billed: true,
                  notified: false, // Assuming missed calls are not explicitly notified as 'connected'
                  serviceType: 'missed_call'
                }));

                console.log(`🚫 MISSED CALLS: ${missedCallsFormatted.length} missed calls (NOT added to connects)`);
                console.log(`✅ TRANSFORMED ${aoiConnectsRaw.length} VDP calls to AOI connects for agent ${agentId}`);
              }
            }
          } catch (error) {
          console.error('❌ Error querying Supabase VDP calls:', error);
        }
      }

      // Fallback to local database if Supabase unavailable or no results
      if (aoiConnectsRaw.length === 0 && missedCallsFormatted.length === 0) {
        console.log(`⚠️ No VDP calls found, checking local AOI connects table...`);
        
        // Apply date filtering to local query if specified
        if (startDateTime && endDateTime) {
          // For local database, we need to convert the datetime strings to dates for comparison
          const startDate = startDateTime.split('T')[0]; // Get YYYY-MM-DD format
          const endDate = endDateTime.split('T')[0];
          
          console.log(`🔍 LOCAL DB: Applying date filter ${startDate} to ${endDate}`);
          
          const localConnects = await db.select()
            .from(schema.aoiConnects)
            .where(
              and(
                eq(schema.aoiConnects.agentId, agentId),
                gte(schema.aoiConnects.callDate, startDate),
                lte(schema.aoiConnects.callDate, endDate)
              )
            )
            .orderBy(schema.aoiConnects.callDate, schema.aoiConnects.callTime);
            
          aoiConnectsRaw = localConnects || [];
        } else {
          const localConnects = await aoiConnectsQuery.orderBy(schema.aoiConnects.callDate, schema.aoiConnects.callTime);
          aoiConnectsRaw = localConnects || [];
        }

        console.log(`📊 Found ${aoiConnectsRaw.length} local AOI connects for agent ${agentId} (after date filtering)`);
      }

      // Convert duration from seconds to human-readable format (MM:SS) and clean up lead IDs
      const aoiConnects = aoiConnectsRaw.map(connect => {
        const durationSeconds = parseInt(connect.duration || '0');
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const humanDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Clean up lead ID - remove decimal point if it exists (safely handle non-string values)
        const cleanLeadId = connect.leadId ? String(connect.leadId).replace('.0', '') : connect.leadId;

        return {
          ...connect,
          leadId: cleanLeadId,
          durationHuman: humanDuration,
          durationSeconds: durationSeconds,
          // If these connects are already deducted from agent credits, mark as billed
          billed: true
        };
      });

      // Get recent transactions with date filtering (if supported by credit service)
      const allTransactions = await creditService.getAgentTransactionHistory(agentId, 100);

      // Filter transactions to only show those with proper service types and correct billing
      const validTransactions = allTransactions.filter(t => {
        const amount = Math.abs(parseFloat(t.amount));
        const hasServiceType = t.serviceType && t.serviceType !== null;
        const hasCorrectAmount = amount >= 3.00; // Minimum is $3.00 for AOI PreCheck
        return hasServiceType || hasCorrectAmount || t.transactionType === 'purchase';
      });

      // Transform AOI connects to match expected VDP format
      const vdpConnects = aoiConnects.map(connect => ({
        id: connect.leadId || connect.id,
        agentId: connect.agentId,
        clientPhone: connect.clientPhone,
        clientName: connect.clientName || 'Unknown Client',
        clientEmail: '',
        clientAddress: '',
        clientCity: '',
        clientState: '',
        market: connect.market,
        clientType: 'AOI_CONNECT',
        leadId: connect.leadId,
        secretKey: '',
        pickupTime: new Date(`${connect.callDate}T${connect.callTime}`),
        connectDate: connect.callDate,
        connectTime: connect.callTime,
        duration: connect.duration,
        billingAmount: parseFloat(connect.billingAmount),
        billed: connect.billed,
        notified: connect.notified
      }));

      // Get recent notifications (simulated for now)
      const notifications = await creditService.getRecentNotifications(agentId);

      // Calculate stats based on AOI connects
      const deductionTransactions = validTransactions.filter(t => t.transactionType === 'usage');
      const additionTransactions = validTransactions.filter(t => t.transactionType === 'purchase');

      // Calculate AOI billing totals
      const totalConnects = aoiConnects.length;
      const totalBilling = totalConnects * 8.00; // $8 per connect
      const missedCallsCount = missedCallsFormatted.length;
      const missedCallsBilling = missedCallsCount * 4.00; // $4 per missed call
      const totalBillingWithMissed = totalBilling + missedCallsBilling;

      console.log(`✅ AOI billing data: ${totalConnects} connects ($${totalBilling}), ${missedCallsCount} missed calls ($${missedCallsBilling}), $${totalBillingWithMissed} total`);

      let aoiBilling = {
        totalConnects,
        totalBilling: totalBilling.toFixed(2),
        connects: aoiConnects,
        missedCalls: missedCallsFormatted,
        missedCallsCount,
        missedCallsBilling: missedCallsBilling.toFixed(2),
        totalBillingWithMissed: totalBillingWithMissed.toFixed(2),
        connectRate: 8.00,
        missedCallRate: 4.00
      };


      res.json({
        success: true,
        data: {
          agentId,
          agentName: creditInfo?.agentName,
          agentEmail: creditInfo?.agentEmail,
          aoiBilling
        }
      });
    } catch (error) {
      console.error("Error getting agent billing dashboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sync AOI connects from Supabase
  app.post("/api/aoi-connects/sync", async (req, res) => {
    try {
      console.log('🔄 Manual AOI Connect sync triggered');

      const { AOIConnectSync } = await import('./aoi-connect-sync');
      const result = await AOIConnectSync.syncFromSupabase();

      res.json({
        success: true,
        message: 'AOI Connect sync completed',
        data: result
      });
    } catch (error) {
      console.error("Error syncing AOI connects:", error);
      res.status(500).json({ error: "Failed to sync AOI connects" });
    }
  });

  // Get agent credit information
  app.get("/api/credits/:agentId", async (req, res) => {
    try {
      const { agentId } = agentIdSchema.parse(req.params);

      const creditInfo = await creditService.getAgentCreditInfo(agentId);

      if (!creditInfo) {
        return res.status(404).json({ error: "Agent not found" });
      }

      res.json({
        success: true,
        data: creditInfo,
      });
    } catch (error) {
      console.error("Error getting agent credit info:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get agent transaction history
  app.get("/api/credits/:agentId/transactions", async (req, res) => {
    try {
      const { agentId } = agentIdSchema.parse(req.params);
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await creditService.getAgentTransactionHistory(agentId, limit);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      console.error("Error getting agent transaction history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add credits to agent account
  app.post("/api/credits/add", async (req, res) => {
    try {
      const validatedData = addCreditsSchema.parse(req.body);

      const result = await creditService.addCredits(
        validatedData.agentId,
        validatedData.amount,
        validatedData.description,
        validatedData.paymentMethod,
        validatedData.paymentId
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          newBalance: result.newBalance,
          transactionId: result.transactionId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error) {
      console.error("Error adding credits:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deduct credits for VDP connect (manual processing)
  app.post("/api/credits/deduct", async (req, res) => {
    try {
      const validatedData = deductCreditsSchema.parse(req.body);

      const result = await creditService.deductCreditsForConnect(
        validatedData.vdpConnectId,
        validatedData.agentId,
        validatedData.phoneNumber,
        validatedData.clientName,
        validatedData.connectDuration,
        validatedData.market
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          newBalance: result.newBalance,
          transactionId: result.transactionId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          currentBalance: result.newBalance,
        });
      }
    } catch (error) {
      console.error("Error deducting credits:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all agents with low balance (admin route)
  app.get("/api/credits/low-balance", async (req, res) => {
    try {
      const lowBalanceAgents = await creditService.getAgentsWithLowBalance();

      res.json({
        success: true,
        data: lowBalanceAgents,
        count: lowBalanceAgents.length,
      });
    } catch (error) {
      console.error("Error getting low balance agents:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Process historical VDP connects (admin route)
  app.post("/api/credits/process-historical", async (req, res) => {
    try {
      // Start processing in background
      creditService.processHistoricalConnects().catch(error => {
        console.error("Error processing historical connects:", error);
      });

      res.json({
        success: true,
        message: "Historical VDP connect processing started in background",
      });
    } catch (error) {
      console.error("Error starting historical processing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Initialize agent credit account
  app.post("/api/credits/initialize/:agentId", async (req, res) => {
    try {
      const { agentId } = agentIdSchema.parse(req.params);

      await creditService.initializeAgentCredits(agentId);
      const creditInfo = await creditService.getAgentCreditInfo(agentId);

      res.json({
        success: true,
        message: "Agent credit account initialized",
        data: creditInfo,
      });
    } catch (error) {
      console.error("Error initializing agent credits:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send daily credit recap emails
  app.post("/api/credits/send-daily-recap", async (req, res) => {
    try {
      const { date } = req.body;
      const result = await creditService.sendDailyCreditRecaps(date);

      res.json({
        success: true,
        sent: result.sent,
        errors: result.errors,
        message: `Daily recap sent to ${result.sent} agents with ${result.errors} errors`
      });
    } catch (error) {
      console.error("Error sending daily credit recaps:", error);
      res.status(500).json({
        error: "Failed to send daily credit recaps",
        message: error.message
      });
    }
  });

  // Send daily billing recap emails
  app.post("/api/billing/send-daily-recap", async (req, res) => {
    try {
      const { date, agentId } = req.body;
      const { DailyBillingRecapService } = await import('./daily-billing-recap-service');

      if (agentId) {
        // Send to specific agent
        const success = await DailyBillingRecapService.sendAgentDailyRecap(agentId, date);
        
        res.json({
          success,
          message: success ? 
            `Daily billing recap sent to agent ${agentId}` : 
            `Failed to send daily billing recap to agent ${agentId}`
        });
      } else {
        // Send to all agents with activity
        const result = await DailyBillingRecapService.sendAllAgentDailyRecaps(date);

        res.json({
          success: true,
          sent: result.sent,
          errors: result.errors,
          details: result.details,
          message: `Daily billing recap sent to ${result.sent} agents with ${result.errors} errors`
        });
      }
    } catch (error) {
      console.error("Error sending daily billing recap:", error);
      res.status(500).json({
        error: "Failed to send daily billing recap",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get daily billing recap data (preview without sending)
  app.get("/api/billing/daily-recap/:agentId/:date", async (req, res) => {
    try {
      const { agentId, date } = req.params;
      const { DailyBillingRecapService } = await import('./daily-billing-recap-service');

      const billingData = await DailyBillingRecapService.getAgentBillingData(agentId, date);

      if (!billingData) {
        return res.status(404).json({
          error: "No billing data found",
          message: `No billing data found for agent ${agentId} on ${date}`
        });
      }

      res.json({
        success: true,
        data: billingData
      });
    } catch (error) {
      console.error("Error getting daily billing recap data:", error);
      res.status(500).json({
        error: "Failed to get daily billing recap data",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // CSV export for complete VDP connects with all client data
  app.get("/api/agent-billing/:agentId/export-csv", async (req, res) => {
    try {
      const { agentId } = agentIdSchema.parse(req.params);

      // Get complete VDP data with all client information
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      const vdpConnectsQuery = `
        SELECT
          connect_date,
          pickup_time,
          end_time,
          duration_seconds,
          agent_id,
          phone as client_phone,
          params
        FROM vdp_connects
        WHERE agent_id = $1
        ORDER BY connect_date DESC, pickup_time DESC
      `;

      const result = await pool.query(vdpConnectsQuery, [agentId]);
      await pool.end();

      // Generate CSV content with complete client data
      const csvHeader = 'Date,Time,Agent ID,Client Phone,First Name,Last Name,Email,Address,City,State,Market,Client Type,Lead ID,Secret Key\n';
      const csvRows = result.rows.map(row => {
        return [
          row.event_date,
          row.event_time,
          row.agent_id,
          row.client_phone || '',
          row.first_name || '',
          row.last_name || '',
          row.email || '',
          row.address || '',
          row.city || '',
          row.state || '',
          row.market || '',
          row.client_type || '',
          row.lead_id || '',
          row.secret_key || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agent-${agentId}-vdp-connects-complete.csv"`);
      res.send(csvContent);

    } catch (error) {
      console.error("Error exporting VDP connects CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  console.log("✅ Credit management routes registered");
}

/** Credit adjustment webhook: apply credits by associate_id (used by external systems). */
export function setupCreditAdjustmentWebhook(app: Express) {
  app.post("/api/webhook/credit-adjustment", express.json(), async (req, res) => {
    try {
      console.log("💳 Credit adjustment webhook received:", req.body);

      const { associate_id, credits_amount } = req.body;

      if (!associate_id || credits_amount === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: associate_id and credits_amount",
        });
      }

      const creditsAmountNumber = Number(credits_amount);
      if (isNaN(creditsAmountNumber)) {
        return res.status(400).json({
          success: false,
          error: "credits_amount must be a valid number",
        });
      }

      const { data: customerData, error: customerError } = await supabaseAdmin
        ?.from("customers")
        .select("company_email")
        .eq("associate_id", associate_id)
        .single();

      if (customerError || !customerData) {
        console.error("❌ Failed to find customer with associate_id:", associate_id, customerError);
        return res.status(404).json({
          success: false,
          error: `No customer found with associate_id: ${associate_id}`,
        });
      }

      const companyEmail = customerData.company_email;
      console.log(`📧 Found company email: ${companyEmail} for associate_id: ${associate_id}`);

      const { data: currentCredits, error: fetchError } = await supabaseAdmin
        ?.from("user_credits")
        .select("aoi_connect_credits_used, credits_used")
        .eq("email", companyEmail)
        .single();

      if (fetchError || !currentCredits) {
        console.error("❌ Failed to find user_credits for email:", companyEmail, fetchError);
        return res.status(404).json({
          success: false,
          error: `No user_credits record found for email: ${companyEmail}`,
        });
      }

      const newAoiConnectCreditsUsed = currentCredits.aoi_connect_credits_used + creditsAmountNumber;
      const newCreditsUsed = currentCredits.credits_used + creditsAmountNumber;

      const { data: updateData, error: updateError } = await supabaseAdmin
        ?.from("user_credits")
        .update({
          aoi_connect_credits_used: newAoiConnectCreditsUsed,
          credits_used: newCreditsUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("email", companyEmail)
        .select()
        .single();

      if (updateError) {
        console.error("❌ Failed to update user_credits:", updateError);
        return res.status(500).json({
          success: false,
          error: "Failed to update user credits",
        });
      }

      console.log(
        `✅ Credit adjustment successful: Associate ID: ${associate_id} Email: ${companyEmail} Credits Applied: ${creditsAmountNumber}`
      );

      res.json({
        success: true,
        message: "Credit adjustment applied successfully",
        data: {
          associate_id,
          company_email: companyEmail,
          credits_applied: creditsAmountNumber,
          previous_aoi_connect_credits_used: currentCredits.aoi_connect_credits_used,
          new_aoi_connect_credits_used: newAoiConnectCreditsUsed,
          previous_credits_used: currentCredits.credits_used,
          new_credits_used: newCreditsUsed,
        },
      });
    } catch (error) {
      console.error("❌ Credit adjustment webhook error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error during credit adjustment",
      });
    }
  });
}