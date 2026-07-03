import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

export interface AOConnectRecord {
  agentEmail: string;
  agentName: string;
  associateId: string;
  connectCount: number;
  totalBilling: number;
  date: string;
}

export class RealBillingService {
  
  /**
   * Get billing data for a specific user email
   */
  static async getUserBillingData(userEmail: string): Promise<{ connects: any[], missedCalls: any[] }> {
    try {
      console.log(`🔍 Getting individual billing data for user: ${userEmail}`);
      
      // First get user's associate_id from Supabase
      if (!supabase) {
        console.error('❌ Supabase not available for user lookup');
        return { connects: [], missedCalls: [] };
      }
      
      const { data: userData, error: userError } = await supabase
        .from('user_credits')
        .select('associate_id, name')
        .eq('email', userEmail.toLowerCase())
        .single();
      
      if (userError || !userData?.associate_id) {
        console.log(`⚠️ No associate_id found for user ${userEmail}`);
        return { connects: [], missedCalls: [] };
      }
      
      const userAssociateId = userData.associate_id.toString();
      console.log(`🎯 Found associate_id ${userAssociateId} for user ${userEmail}`);
      
      // Get all connects and filter by this user's associate_id
      const allConnects = await this.analyzeConnectsForBilling();
      const userConnects = allConnects.filter(connect => 
        connect.associate_id.toString() === userAssociateId
      );
      
      // Get all missed calls and filter by this user's associate_id
      const allMissedCalls = await this.analyzeMissedCallsForBilling();
      const userMissedCalls = allMissedCalls.filter(missed => 
        missed.associate_id.toString() === userAssociateId
      );
      
      console.log(`✅ Found ${userConnects.length} connects and ${userMissedCalls.length} missed call records for user ${userEmail}`);
      
      return {
        connects: userConnects,
        missedCalls: userMissedCalls
      };
      
    } catch (error) {
      console.error(`❌ Error getting user billing data for ${userEmail}:`, error);
      return { connects: [], missedCalls: [] };
    }
  }
  
  /**
   * Update user_credits table with missed call counts from CSV billing analysis
   */
  static async updateMissedCallBilling(): Promise<{ success: number; failed: number; details: any[] }> {
    try {
      console.log('🚨🚨🚨 UPDATING MISSED CALL BILLING IN SUPABASE 🚨🚨🚨');
      
      // Get missed call data from our billing analysis
      const missedCallData = await this.analyzeMissedCallsForBilling();
      
      console.log(`📊 Found ${missedCallData.length} agents with missed calls to bill`);
      
      let successCount = 0;
      let failedCount = 0;
      const details: any[] = [];
      
      // Update each agent's missed call count in user_credits table
      for (const agentData of missedCallData) {
        try {
          console.log(`💳 Billing agent ${agentData.associate_id} for ${agentData.missedCallCount} missed calls`);
          
          const { error } = await supabase
            .from('user_credits')
            .update({ 
              aoi_missed_calls: agentData.missedCallCount,
              missed_calls: agentData.missedCallCount * 4.00, // $4 per missed call
              updated_at: new Date().toISOString()
            })
            .eq('associate_id', agentData.associate_id);
          
          if (error) {
            console.error(`❌ Failed to update billing for agent ${agentData.associate_id}:`, error);
            failedCount++;
            details.push({
              status: 'failed',
              associate_id: agentData.associate_id,
              agentName: agentData.agentName,
              missedCallCount: agentData.missedCallCount,
              error: error.message
            });
          } else {
            console.log(`✅ Successfully billed agent ${agentData.associate_id} for ${agentData.missedCallCount} missed calls`);
            successCount++;
            details.push({
              status: 'success',
              associate_id: agentData.associate_id,
              agentName: agentData.agentName,
              missedCallCount: agentData.missedCallCount,
              billingAmount: agentData.missedCallCount * 4.00
            });
          }
        } catch (error) {
          console.error(`❌ Error updating billing for agent ${agentData.associate_id}:`, error);
          failedCount++;
          details.push({
            status: 'failed',
            associate_id: agentData.associate_id,
            agentName: agentData.agentName || 'Unknown',
            missedCallCount: agentData.missedCallCount,
            error: error.message
          });
        }
      }
      
      console.log(`✅ Missed call billing update complete: ${successCount} success, ${failedCount} failed`);
      
      return {
        success: successCount,
        failed: failedCount,
        details
      };
      
    } catch (error) {
      console.error('❌ Error in updateMissedCallBilling:', error);
      return { success: 0, failed: 0, details: [{ error: error.message }] };
    }
  }

  /**
   * Analyze CSV data to get connect data per agent for billing
   */
  static async analyzeConnectsForBilling(): Promise<any[]> {
    const csvPath = path.join(process.cwd(), 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757133059447.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      return [];
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    // Parse ALL events first
    const allEvents: any[] = [];
    lines.forEach((line, index) => {
      if (line.trim()) {
        // Handle CSV with quoted fields properly
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const fields = line.split(csvRegex);
        
        if (fields.length >= 5) {
          let [date, time, event, phone, agent, ...params] = fields;
          
          // Clean quotes and extract first agent ID if comma-separated
          agent = agent?.replace(/^"/, '').replace(/"$/, '');
          if (agent?.includes(',')) {
            agent = agent.split(',')[0]; // Take first agent ID
          }
          
          if (event && agent && agent.trim() !== '' && phone) {
            allEvents.push({
              date: date?.trim(),
              time: time?.trim(),
              event: event?.trim(),
              phone: phone?.trim(),
              agent: agent?.trim(),
              timestamp: new Date(`${date?.trim()} ${time?.trim()}`).getTime()
            });
          }
        }
      }
    });

    // Find successful connects: BLASTER events with corresponding PICK_UP
    const blasterEvents = allEvents.filter(e => e.event === 'BLASTER');
    const pickupEvents = allEvents.filter(e => e.event === 'PICK_UP');
    
    const connects: any[] = [];
    const processedKeys = new Set<string>();

    blasterEvents.forEach(blaster => {
      const key = `${blaster.agent}-${blaster.phone}`;
      
      if (processedKeys.has(key)) return; // Avoid duplicates
      processedKeys.add(key);
      
      // Find matching PICK_UP for this agent + phone combination
      const pickup = pickupEvents.find(p => 
        p.phone === blaster.phone && 
        p.agent === blaster.agent
      );
      
      if (pickup) {
        // This is a successful connect
        connects.push({
          associate_id: parseInt(blaster.agent),
          phone: blaster.phone,
          date: blaster.date,
          time: blaster.time,
          pickupTime: pickup.time,
          duration: 180 // Assume 3 minute duration for billing
        });
      }
    });

    // Get agent lookup data from Supabase to match names
    const agentLookup = new Map<string, { name: string; email: string; mga: string }>();
    
    if (supabase) {
      const { data: producerData, error } = await supabase
        .from('producerlist')
        .select('associate_id, agent_name, company_email, mga, rga')
        .range(0, 9999); // Get up to 10,000 agents
        
      if (!error && producerData) {
        producerData.forEach(row => {
          if (row.associate_id && row.agent_name) {
            const agentId = row.associate_id.toString();
            agentLookup.set(agentId, {
              name: row.agent_name,
              email: row.company_email || 'Unknown Email',
              mga: row.mga || row.rga || 'Unassigned MGA'
            });
          }
        });
      }
    }

    // Add agent names to connects - only include agents that exist in our lookup
    const result = connects
      .map(connect => {
        const agent = agentLookup.get(connect.associate_id.toString());
        if (!agent) return null; // Filter out agents not in our system
        
        return {
          ...connect,
          agentName: agent.name,
          agentEmail: agent.email,
          mga: agent.mga || 'Unassigned MGA'
        };
      })
      .filter(connect => connect !== null); // Remove null entries

    return result.sort((a, b) => b.associate_id - a.associate_id);
  }

  /**
   * Analyze CSV data to get missed call counts per agent for billing
   */
  static async analyzeMissedCallsForBilling(): Promise<any[]> {
    // Read and parse CSV data (same logic as sendMissedLeadsToAgents but just return counts)
    const csvPath = path.join(process.cwd(), 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757133059447.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      return [];
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    
    // Parse ALL events first
    const allEvents: any[] = [];
    lines.forEach((line, index) => {
      if (line.trim()) {
        // Handle CSV with quoted fields properly
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const fields = line.split(csvRegex);
        
        if (fields.length >= 5) {
          let [date, time, event, phone, agent, ...params] = fields;
          
          // Clean quotes and extract first agent ID if comma-separated
          agent = agent?.replace(/^"/, '').replace(/"$/, '');
          if (agent?.includes(',')) {
            agent = agent.split(',')[0]; // Take first agent ID
          }
          
          if (event && agent && agent.trim() !== '' && phone) {
            allEvents.push({
              date: date?.trim(),
              time: time?.trim(),
              event: event?.trim(),
              phone: phone?.trim(),
              agent: agent?.trim(),
              timestamp: new Date(`${date?.trim()} ${time?.trim()}`).getTime()
            });
          }
        }
      }
    });

    // Find Missed Calls: BLASTER events without corresponding PICK_UP
    const blasterEvents = allEvents.filter(e => e.event === 'BLASTER');
    const uniqueCallAttempts = new Map<string, any[]>();
    
    // Group BLASTER events by Agent + Phone combination
    blasterEvents.forEach(blaster => {
      const key = `${blaster.agent}-${blaster.phone}`;
      if (!uniqueCallAttempts.has(key)) {
        uniqueCallAttempts.set(key, []);
      }
      uniqueCallAttempts.get(key)!.push(blaster);
    });

    const agentMissedCalls = new Map<string, number>();

    // For each unique Agent + Phone combination, check if it was a missed call
    uniqueCallAttempts.forEach((blasters, key) => {
      const [agentId, phone] = key.split('-');
      
      // Check if there's ANY PICK_UP for this Agent + Phone combination
      const hasPickUp = allEvents.some(e => 
        e.event === 'PICK_UP' && 
        e.phone === phone && 
        e.agent === agentId
      );
      
      if (!hasPickUp) {
        // This is a missed call - count it for this agent
        const currentCount = agentMissedCalls.get(agentId) || 0;
        agentMissedCalls.set(agentId, currentCount + 1);
      }
    });

    // Get agent lookup data from Supabase to match names
    const agentLookup = new Map<string, { name: string; email: string; mga: string }>();
    
    if (supabase) {
      const { data: producerData, error } = await supabase
        .from('producerlist')
        .select('associate_id, agent_name, company_email, mga, rga')
        .range(0, 9999); // Get up to 10,000 agents
        
      if (!error && producerData) {
        producerData.forEach(row => {
          if (row.associate_id && row.agent_name) {
            const agentId = row.associate_id.toString();
            agentLookup.set(agentId, {
              name: row.agent_name,
              email: row.company_email || 'Unknown Email',
              mga: row.mga || row.rga || 'Unassigned MGA'
            });
          }
        });
      }
    }

    // Convert to array format with agent names - only include agents that actually have missed calls from CSV
    const result: any[] = [];
    agentMissedCalls.forEach((missedCallCount, agentId) => {
      const agent = agentLookup.get(agentId);
      // Only include if agent exists in our lookup AND has missed calls
      if (agent && missedCallCount > 0) {
        result.push({
          associate_id: parseInt(agentId),
          agentName: agent.name,
          agentEmail: agent.email,
          mga: agent.mga || 'Unassigned MGA',
          missedCallCount
        });
      }
    });

    return result.sort((a, b) => b.missedCallCount - a.missedCallCount);
  }

  /**
   * Send all missed call leads back to their respective agents via Planet ALTIG webhook
   */
  static async sendMissedLeadsToAgents(): Promise<{ success: number; failed: number; details: any[] }> {
    try {
      console.log('🚨🚨🚨 SENDING MISSED LEADS TO AGENTS 🚨🚨🚨');
      
      // Read the CSV file
      const csvPath = path.join(process.cwd(), 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757133059447.csv');
      
      if (!fs.existsSync(csvPath)) {
        console.error('❌ CSV file not found:', csvPath);
        return { success: 0, failed: 0, details: [] };
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').slice(1); // Skip header
      
      console.log(`📊 Processing ${lines.length} CSV lines for missed calls...`);

      // Parse ALL events first
      const allEvents: any[] = [];
      lines.forEach((line, index) => {
        if (line.trim()) {
          // Handle CSV with quoted fields properly
          const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const fields = line.split(csvRegex);
          
          if (fields.length >= 5) {
            let [date, time, event, phone, agent, ...params] = fields;
            
            // Clean quotes and extract first agent ID if comma-separated
            agent = agent?.replace(/^"/, '').replace(/"$/, '');
            if (agent?.includes(',')) {
              agent = agent.split(',')[0]; // Take first agent ID
            }
            
            // Parse JSON params to extract lead information
            let leadData = null;
            if (params.length > 0) {
              try {
                const paramsStr = params.join(',').replace(/^"/, '').replace(/"$/, '');
                leadData = JSON.parse(paramsStr);
              } catch (e) {
                // JSON parsing failed, skip this record
              }
            }
            
            if (event && agent && agent.trim() !== '' && phone) {
              allEvents.push({
                csvLine: index + 2,
                date: date?.trim(),
                time: time?.trim(),
                event: event?.trim(),
                phone: phone?.trim(),
                agent: agent?.trim(),
                leadData,
                timestamp: new Date(`${date?.trim()} ${time?.trim()}`).getTime()
              });
            }
          }
        }
      });

      console.log(`📊 Parsed ${allEvents.length} total events from CSV`);

      // Find Missed Calls: BLASTER events without corresponding PICK_UP
      const blasterEvents = allEvents.filter(e => e.event === 'BLASTER');
      const uniqueCallAttempts = new Map<string, any[]>();
      
      // Group BLASTER events by Agent + Phone combination
      blasterEvents.forEach(blaster => {
        const key = `${blaster.agent}-${blaster.phone}`;
        if (!uniqueCallAttempts.has(key)) {
          uniqueCallAttempts.set(key, []);
        }
        uniqueCallAttempts.get(key)!.push(blaster);
      });

      console.log(`🔍 Found ${uniqueCallAttempts.size} unique Agent + Phone combinations`);

      const missedCallsToSend: any[] = [];

      // For each unique Agent + Phone combination, check if it was a missed call (no PICK_UP)
      uniqueCallAttempts.forEach((blasters, key) => {
        const [agentId, phone] = key.split('-');
        
        // Sort blasters by timestamp to understand the call timeline
        blasters.sort((a, b) => a.timestamp - b.timestamp);
        
        // Check if there's ANY PICK_UP for this Agent + Phone combination
        const hasPickUp = allEvents.some(e => 
          e.event === 'PICK_UP' && 
          e.phone === phone && 
          e.agent === agentId
        );
        
        if (!hasPickUp) {
          // This is a missed call - take the first BLASTER event for this combination
          const firstBlaster = blasters[0];
          
          if (firstBlaster.leadData && firstBlaster.leadData.Leadid) {
            missedCallsToSend.push({
              associate_id: parseInt(agentId),
              leadId: firstBlaster.leadData.Leadid,
              phone: phone,
              leadName: `${firstBlaster.leadData['First Name'] || ''} ${firstBlaster.leadData['Last Name'] || ''}`.trim(),
              attempts: blasters.length,
              firstAttempt: firstBlaster.date + ' ' + firstBlaster.time
            });
          }
        }
      });

      console.log(`✅ Found ${missedCallsToSend.length} missed calls to send back to agents`);

      // Send each missed call to Planet ALTIG webhook
      let successCount = 0;
      let failedCount = 0;
      const details: any[] = [];

      for (const missedCall of missedCallsToSend) {
        try {
          const webhookPayload = {
            leadId: missedCall.leadId,
            associate_id: missedCall.associate_id
          };

          console.log(`📤 Sending missed lead ${missedCall.leadId} to agent ${missedCall.associate_id} (${missedCall.leadName})`);

          // Send to Zapier webhook (Zapier forwards to Planet) - this is what works!
          const webhookResponse = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookPayload)
          });

          if (webhookResponse.ok) {
            const responseData = await webhookResponse.json();
            console.log(`✅ Successfully sent lead ${missedCall.leadId} to agent ${missedCall.associate_id}`);
            successCount++;
            details.push({
              status: 'success',
              leadId: missedCall.leadId,
              associate_id: missedCall.associate_id,
              leadName: missedCall.leadName,
              response: responseData
            });
          } else {
            console.error(`❌ Failed to send lead ${missedCall.leadId} to agent ${missedCall.associate_id}:`, webhookResponse.status);
            failedCount++;
            details.push({
              status: 'failed',
              leadId: missedCall.leadId,
              associate_id: missedCall.associate_id,
              leadName: missedCall.leadName,
              error: `HTTP ${webhookResponse.status}`
            });
          }
        } catch (error) {
          console.error(`❌ Error sending lead ${missedCall.leadId} to agent ${missedCall.associate_id}:`, error);
          failedCount++;
          details.push({
            status: 'failed',
            leadId: missedCall.leadId,
            associate_id: missedCall.associate_id,
            leadName: missedCall.leadName,
            error: error.message
          });
        }

        // Add small delay to avoid overwhelming the webhook
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Missed lead redistribution complete: ${successCount} success, ${failedCount} failed`);
      
      return {
        success: successCount,
        failed: failedCount,
        details
      };
      
    } catch (error) {
      console.error('❌ Error in sendMissedLeadsToAgents:', error);
      return { success: 0, failed: 0, details: [{ error: error.message }] };
    }
  }
  
  // DEBUG FUNCTION: Look up specific agent
  async debugAgent(agentId: string) {
    console.log(`🔍 DEBUG: Looking up agent ${agentId}`);
    
    if (!supabase) {
      console.log('❌ No supabase client');
      return null;
    }
    
    const { data, error } = await supabase
      .from('producerlist')
      .select('*')
      .eq('associate_id', agentId)
      .single();
      
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return null;
    }
    
    console.log(`✅ Agent ${agentId} found: ${JSON.stringify(data)}`);
    return data;
  }
  /**
   * Analyze CSV data to identify AO Connects
   * AO Connect = CONNECT event in CSV with Agent ID
   */
  static async analyzeAOConnects(): Promise<AOConnectRecord[]> {
    try {
      console.log('🚨🚨🚨 ANALYZING AO CONNECTS - DEBUG MODE 🚨🚨🚨');
      
      // Read the CSV file
      const csvPath = path.join(process.cwd(), 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757133059447.csv');
      
      if (!fs.existsSync(csvPath)) {
        console.error('❌ CSV file not found:', csvPath);
        return [];
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').slice(1); // Skip header
      
      console.log(`📊 Processing ${lines.length} CSV lines...`);

      // Parse ALL events first
      const allEvents: any[] = [];
      lines.forEach((line, index) => {
        if (line.trim()) {
          // Handle CSV with quoted fields properly
          const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const fields = line.split(csvRegex);
          
          if (fields.length >= 5) {
            let [date, time, event, phone, agent, ...params] = fields;
            
            // Clean quotes and extract first agent ID if comma-separated
            agent = agent?.replace(/^"/, '').replace(/"$/, '');
            if (agent?.includes(',')) {
              agent = agent.split(',')[0]; // Take first agent ID
            }
            
            if (event && agent && agent.trim() !== '' && phone) {
              allEvents.push({
                csvLine: index + 2,
                date: date?.trim(),
                time: time?.trim(),
                event: event?.trim(),
                phone: phone?.trim(),
                agent: agent?.trim(),
                timestamp: new Date(`${date?.trim()} ${time?.trim()}`).getTime()
              });
            }
          }
        }
      });

      console.log(`📊 Parsed ${allEvents.length} total events from CSV`);

      // Find real CONNECTS: PICK_UP followed by END after 12+ seconds
      const aoConnects = [];
      let validConnects = 0;
      const pickUpEvents = allEvents.filter(e => e.event === 'PICK_UP');
      
      console.log(`🔍 Found ${pickUpEvents.length} PICK_UP events, analyzing for real connects...`);

      pickUpEvents.forEach(pickUp => {
        // Find matching END event for same phone/agent
        const endEvent = allEvents.find(e => 
          e.event === 'END' && 
          e.phone === pickUp.phone && 
          e.agent === pickUp.agent &&
          e.timestamp > pickUp.timestamp &&
          (e.timestamp - pickUp.timestamp) >= 12000 // 12+ seconds = real connect
        );
        
        if (endEvent) {
          const durationSeconds = Math.round((endEvent.timestamp - pickUp.timestamp) / 1000);
          validConnects++;
          
          aoConnects.push({
            csvLine: pickUp.csvLine,
            agentId: pickUp.agent,
            date: pickUp.date,
            time: pickUp.time,
            billing: 8.00, // $8.00 per real AO Connect
            phone: pickUp.phone,
            duration: durationSeconds,
            event: 'REAL_CONNECT'
          });
          
          console.log(`✅ Real connect: Agent ${pickUp.agent}, Phone ${pickUp.phone}, Duration ${durationSeconds}s`);
        }
      });

      console.log(`✅ Found ${validConnects} AO Connects from CSV data`);

      // Find Missed Calls: ONLY ONE CHARGE per unique Agent + Phone combination that was attempted but not answered
      const missedCalls = [];
      let validMissedCalls = 0;
      const blasterEvents = allEvents.filter(e => e.event === 'BLASTER');
      
      console.log(`🔍 Found ${blasterEvents.length} BLASTER events, analyzing for missed calls...`);
      
      // Group BLASTER events by Agent + Phone to identify unique call attempts
      const uniqueCallAttempts = new Map<string, any[]>();
      blasterEvents.forEach(blaster => {
        const key = `${blaster.agent}-${blaster.phone}`;
        if (!uniqueCallAttempts.has(key)) {
          uniqueCallAttempts.set(key, []);
        }
        uniqueCallAttempts.get(key)!.push(blaster);
      });

      console.log(`🔍 Found ${uniqueCallAttempts.size} unique Agent + Phone combinations`);

      // For each unique Agent + Phone combination, check if it was a missed call (no PICK_UP)
      uniqueCallAttempts.forEach((blasters, key) => {
        const [agentId, phone] = key.split('-');
        
        // Sort blasters by timestamp to understand the call timeline
        blasters.sort((a, b) => a.timestamp - b.timestamp);
        
        // Check if there's ANY PICK_UP for this Agent + Phone combination
        const hasAnyPickUp = allEvents.some(event => 
          event.event === 'PICK_UP' && 
          event.agent === agentId && 
          event.phone === phone
        );
        
        if (!hasAnyPickUp) {
          // This is a missed call - ONLY charge once per unique Agent + Phone combination
          const firstBlaster = blasters[0];
          const lastBlaster = blasters[blasters.length - 1];
          const totalDuration = Math.round((lastBlaster.timestamp - firstBlaster.timestamp) / 1000);
          
          // Only bill if the call attempt lasted at least 10 seconds (shows real attempt)
          if (totalDuration >= 10) {
            validMissedCalls++;
            missedCalls.push({
              csvLine: firstBlaster.csvLine,
              agentId: agentId,
              date: firstBlaster.date,
              time: firstBlaster.time,
              phone: phone,
              billing: 4.00, // $4.00 per unique missed call instance
              totalDuration: totalDuration,
              blasterCount: blasters.length,
              event: 'MISSED_CALL'
            });
            
            console.log(`❌ UNIQUE missed call: Agent ${agentId}, Phone ${phone}, Duration ${totalDuration}s, ${blasters.length} rings, Billing: $4.00`);
          } else {
            console.log(`⏭️ Skipped short attempt: Agent ${agentId}, Phone ${phone}, Duration ${totalDuration}s (< 10s threshold)`);
          }
        } else {
          console.log(`✅ Answered call: Agent ${agentId}, Phone ${phone} - No billing`);
        }
      });

      console.log(`✅ Found ${validMissedCalls} Missed Calls from CSV data`);
      console.log('🔥 ABOUT TO START SUPABASE LOOKUP');

      // Get ALL agent lookup data from Supabase
      console.log('🔥 Loading ALL agents from Supabase producerlist...');
      
      const agentLookup = new Map<string, { name: string; email: string; mga: string }>();
      
      try {
        if (!supabase) {
          console.error('❌ SUPABASE CLIENT IS NULL');
          return [];
        }
        
        const { data: producerData, error } = await supabase
          .from('producerlist')
          .select('associate_id, agent_name, company_email, mga, rga')
          .range(0, 9999); // Get up to 10,000 agents to ensure we get ALL data
          
        if (error) {
          console.error('❌ Supabase error:', error);
          return [];
        }
        
        if (producerData && producerData.length > 0) {
          console.log(`📊 Loaded ${producerData.length} agents from Supabase`);
          
          producerData.forEach(row => {
            if (row.associate_id && row.agent_name) {
              const agentId = row.associate_id.toString();
              agentLookup.set(agentId, {
                name: row.agent_name,
                email: row.company_email || 'Unknown Email',
                mga: row.mga || row.rga || 'Unassigned MGA'
              });
            }
          });
          
          console.log(`✅ Created lookup map for ${agentLookup.size} agents`);
          
          // Log sample of agents loaded
          const sampleAgents = Array.from(agentLookup.entries()).slice(0, 3);
          console.log('📋 Sample agents loaded:');
          sampleAgents.forEach(([id, agent]) => {
            console.log(`   ${id}: ${agent.name} (${agent.mga})`);
          });
          
        } else {
          console.log('❌ No producer data found in Supabase');
          return [];
        }
      } catch (err) {
        console.error('❌ Database query failed:', err);
        return [];
      }

      // Group AO Connects and Missed Calls by agent ID and calculate totals
      const agentTotals = new Map<string, any>();
      
      // Get ALL unique agent IDs first
      const allAgentIds = new Set<string>();
      aoConnects.forEach((connect: any) => allAgentIds.add(connect.agentId.toString()));
      missedCalls.forEach((call: any) => allAgentIds.add(call.agentId.toString()));
      
      console.log(`🔥 Need to lookup ${allAgentIds.size} unique agents from Supabase`);
      
      // FORCE bulk lookup ALL agents at once
      const agentIdArray = Array.from(allAgentIds).map(id => parseInt(id));
      const { data: allAgentData, error: bulkError } = await supabase!
        .from('producerlist')
        .select('associate_id, agent_name, company_email, mga, rga')
        .in('associate_id', agentIdArray);
      
      if (bulkError) {
        console.error('❌ Bulk agent lookup failed:', bulkError);
        return [];
      }
      
      // Create WORKING lookup map
      const workingLookup = new Map<string, any>();
      allAgentData?.forEach(agent => {
        if (agent.associate_id && agent.agent_name) {
          workingLookup.set(agent.associate_id.toString(), {
            name: agent.agent_name,
            email: agent.company_email || 'Unknown Email',
            mga: agent.mga || agent.rga || 'Unassigned MGA'
          });
        }
      });
      
      console.log(`✅ WORKING LOOKUP: ${workingLookup.size} agents loaded successfully`);
      
      // Test for agent 188459
      if (workingLookup.has('188459')) {
        const test = workingLookup.get('188459');
        console.log(`🎯 VERIFIED: Agent 188459 = ${test.name} under ${test.mga}`);
      }

      // Add AO Connects using WORKING lookup
      aoConnects.forEach((connect: any) => {
        const agentIdStr = connect.agentId.toString();
        const agentInfo = workingLookup.get(agentIdStr);
        
        if (!agentTotals.has(agentIdStr)) {
          agentTotals.set(agentIdStr, {
            agentEmail: agentInfo?.email || 'Unknown Email',
            agentName: agentInfo?.name || 'Unknown Agent',
            associateId: agentIdStr,
            mga: agentInfo?.mga || 'Unknown MGA',
            connectCount: 0,
            missedCallCount: 0,
            totalBilling: 0,
            date: connect.date
          });
        }

        const agent = agentTotals.get(agentIdStr);
        agent.connectCount++;
        agent.totalBilling += connect.billing;
      });

      // Add Missed Calls using WORKING lookup
      missedCalls.forEach((missedCall: any) => {
        const agentIdStr = missedCall.agentId.toString();
        const agentInfo = workingLookup.get(agentIdStr);

        if (!agentTotals.has(agentIdStr)) {
          agentTotals.set(agentIdStr, {
            agentEmail: agentInfo?.email || 'Unknown Email',
            agentName: agentInfo?.name || 'Unknown Agent',
            associateId: agentIdStr,
            mga: agentInfo?.mga || 'Unknown MGA',
            connectCount: 0,
            missedCallCount: 0,
            totalBilling: 0,
            date: missedCall.date
          });
        }

        const agent = agentTotals.get(agentIdStr);
        agent.missedCallCount++;
        agent.totalBilling += missedCall.billing;
      });

      const results = Array.from(agentTotals.values());
      
      console.log(`📊 Final results: ${results.length} agents with AO Connects or Missed Calls`);
      results.forEach(agent => {
        console.log(`   ${agent.agentName}: ${agent.connectCount} connects = $${agent.totalBilling.toFixed(2)}, ${agent.missedCallCount} missed calls`);
      });

      return results;
    } catch (error) {
      console.error('❌ Error analyzing AO Connects:', error);
      throw error;
    }
  }

  /**
   * Generate AO Connect billing report using real call analysis
   */
  static async generateRealConnectReport(): Promise<string> {
    try {
      const aoConnects = await this.analyzeAOConnects();
      
      const csvHeader = 'Email,Agent Name,Associate ID,AO Connects,Total Billing,Date\n';
      const csvRows = aoConnects.map(record => {
        return `"${record.agentEmail}","${record.agentName}","${record.associateId}","${record.connectCount}","$${record.totalBilling.toFixed(2)}","${record.date}"`;
      }).join('\n');

      console.log('✅ Real AO Connect billing report generated');
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating real Connect report:', error);
      throw error;
    }
  }

  /**
   * Generate MGA report using real AO Connect data
   */
  static async generateRealMGAReport(): Promise<string> {
    try {
      const aoConnects = await this.analyzeAOConnects();
      
      // Get MGA team assignments from customers table
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, agent_name');

      if (customerError) throw customerError;

      // Create lookup for MGA teams
      const mgaLookup = new Map();
      customerData?.forEach(customer => {
        if (customer.company_email) {
          mgaLookup.set(customer.company_email, customer.agent_name || 'Unassigned');
        }
      });

      // Group by MGA teams
      const mgaTeams = new Map();
      
      aoConnects.forEach(record => {
        const mgaTeam = mgaLookup.get(record.agentEmail) || 'Unassigned';
        
        if (!mgaTeams.has(mgaTeam)) {
          mgaTeams.set(mgaTeam, []);
        }
        
        mgaTeams.get(mgaTeam).push(record);
      });

      // Generate CSV
      const csvHeader = 'MGA Team,Agent Name,Email,Associate ID,AO Connects,Total Billing,Date\n';
      let csvRows = '';
      
      mgaTeams.forEach((agents, mgaTeam) => {
        agents.forEach(agent => {
          csvRows += `"${mgaTeam}","${agent.agentName}","${agent.agentEmail}","${agent.associateId}","${agent.connectCount}","$${agent.totalBilling.toFixed(2)}","${agent.date}"\n`;
        });
      });

      console.log('✅ Real MGA billing report generated');
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating real MGA report:', error);
      throw error;
    }
  }

  /**
   * Generate billing summary using real AO Connect data
   */
  static async generateRealBillingSummary(): Promise<string> {
    try {
      const aoConnects = await this.analyzeAOConnects();
      
      const csvHeader = 'Email,Agent Name,Associate ID,AO Connects,Total Billing,Date\n';
      const csvRows = aoConnects.map(record => {
        return `"${record.agentEmail}","${record.agentName}","${record.associateId}","${record.connectCount}","$${record.totalBilling.toFixed(2)}","${record.date}"`;
      }).join('\n');

      console.log('✅ Real billing summary generated');
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating real billing summary:', error);
      throw error;
    }
  }

  /**
   * Generate MGA hierarchy breakdown for dashboard display
   */
  static async generateMGAHierarchyBreakdown(): Promise<any> {
    try {
      console.log('🔥 Generating MGA hierarchy breakdown...');
      
      const aoConnects = await this.analyzeAOConnects();
      
      // Group by MGA teams using the mga field from agent data
      const mgaTeams = new Map();
      
      aoConnects.forEach(record => {
        const mgaTeam = record.mga || 'Unassigned MGA';
        
        if (!mgaTeams.has(mgaTeam)) {
          mgaTeams.set(mgaTeam, {
            mgaName: mgaTeam,
            totalConnects: 0,
            totalMissedCalls: 0,
            totalBilling: 0,
            agents: []
          });
        }
        
        const team = mgaTeams.get(mgaTeam);
        team.totalConnects += record.connectCount;
        team.totalMissedCalls += record.missedCallCount || 0;
        team.totalBilling += record.totalBilling;
        team.agents.push({
          agentName: record.agentName,
          agentEmail: record.agentEmail,
          associateId: record.associateId,
          connects: record.connectCount,
          missedCalls: record.missedCallCount || 0,
          billing: record.totalBilling
        });
      });

      // Convert to array and sort by total billing
      const hierarchy = Array.from(mgaTeams.values())
        .sort((a, b) => b.totalBilling - a.totalBilling)
        .map(team => ({
          ...team,
          agents: team.agents.sort((a: any, b: any) => b.billing - a.billing)
        }));

      console.log('✅ MGA hierarchy breakdown generated successfully');
      return hierarchy;
    } catch (error) {
      console.error('❌ Error generating MGA hierarchy breakdown:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: Update individual agent dashboards with real billing data from CSV
   * This syncs CSV billing data directly to agent accounts for dashboard display
   */
  static async updateAgentDashboardBilling(): Promise<void> {
    try {
      console.log('🔥 SYNCING REAL CSV BILLING DATA TO AGENT DASHBOARDS...');
      
      // Get the real billing data from CSV analysis
      const aoConnects = await this.analyzeAOConnects();
      
      console.log(`💰 Processing billing updates for ${aoConnects.length} agents from CSV data...`);
      
      // Update each agent's billing data in user_credits table
      for (const agent of aoConnects) {
        try {
          console.log(`💰 Updating agent dashboard billing: ${agent.agentName} (ID: ${agent.associateId})`);
          console.log(`   - AO Connects: ${agent.connectCount} × $8.00 = $${(agent.connectCount * 8).toFixed(2)}`);
          console.log(`   - Missed Calls: ${agent.missedCallCount || 0} × $4.00 = $${((agent.missedCallCount || 0) * 4).toFixed(2)}`);
          console.log(`   - Total Billing: $${agent.totalBilling.toFixed(2)}`);
          
          // Calculate individual billing components
          const aoConnectCharges = agent.connectCount * 8.00;
          const missedCallCharges = (agent.missedCallCount || 0) * 4.00;
          
          // First, try to find existing record by associate_id
          const { data: existingRecord, error: findError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('associate_id', parseInt(agent.associateId))
            .single();

          if (findError && findError.code !== 'PGRST116') {
            console.error(`❌ Error finding existing record for agent ${agent.associateId}:`, findError);
            continue;
          }

          if (existingRecord) {
            // Update existing record
            console.log(`📝 Updating existing billing record for agent ${agent.agentName}...`);
            
            const { error: updateError } = await supabase
              .from('user_credits')
              .update({
                // Real AO Connect billing data from CSV
                aoi_connect_credits_used: agent.connectCount,
                aoi_connect_billing: aoConnectCharges,
                
                // Real missed call billing data from CSV  
                aoi_missed_calls: agent.missedCallCount || 0,
                missed_calls: missedCallCharges,
                
                // Agent information from CSV analysis
                name: agent.agentName,
                email: agent.agentEmail,
                
                // Update timestamp
                updated_at: new Date().toISOString()
              })
              .eq('associate_id', parseInt(agent.associateId));

            if (updateError) {
              console.error(`❌ Error updating agent ${agent.associateId} billing:`, updateError);
            } else {
              console.log(`✅ Updated dashboard billing for ${agent.agentName}: AO Connects $${aoConnectCharges.toFixed(2)}, Missed Calls $${missedCallCharges.toFixed(2)}`);
            }
          } else {
            // Create new record
            console.log(`📝 Creating new billing record for agent ${agent.agentName}...`);
            
            const { error: insertError } = await supabase
              .from('user_credits')
              .insert({
                associate_id: parseInt(agent.associateId),
                
                // Real AO Connect billing data from CSV
                aoi_connect_credits_used: agent.connectCount,
                aoi_connect_billing: aoConnectCharges,
                
                // Real missed call billing data from CSV
                aoi_missed_calls: agent.missedCallCount || 0,
                missed_calls: missedCallCharges,
                
                // Agent information from CSV analysis
                name: agent.agentName,
                email: agent.agentEmail,
                
                // Initialize other fields
                credits_remaining: 50,
                credits_used: 0,
                credits_purchased: 50,
                aoi_plus_credits_used: 0,
                aoi_precheck_credits_used: 0,
                aoi_recruit_credits_used: 0,
                
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) {
              console.error(`❌ Error creating agent ${agent.associateId} billing record:`, insertError);
            } else {
              console.log(`✅ Created dashboard billing for ${agent.agentName}: AO Connects $${aoConnectCharges.toFixed(2)}, Missed Calls $${missedCallCharges.toFixed(2)}`);
            }
          }
          
        } catch (agentError) {
          console.error(`❌ Error processing agent ${agent.associateId}:`, agentError);
          continue;
        }
      }
      
      console.log('✅ AGENT DASHBOARD BILLING SYNC COMPLETED - All CSV billing data now reflected in individual agent dashboards!');
      
    } catch (error) {
      console.error('❌ Error updating agent dashboard billing:', error);
      throw error;
    }
  }
}