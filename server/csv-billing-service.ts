import { supabase } from './supabase';

export interface AOConnectRecord {
  agentEmail: string;
  agentName: string;
  associateId: string;
  connectCount: number;
  totalBilling: number;
  date: string;
}

export class CSVBillingService {
  /**
   * Parse CSV data to find AO Connects (PICK_UP + END events with 12+ second duration)
   */
  static async processCSVData(csvData: string): Promise<AOConnectRecord[]> {
    try {
      console.log('🔥 Processing CSV data for AO Connects...');
      
      const lines = csvData.split('\n');
      const header = lines[0];
      
      // Parse CSV rows
      const events = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length >= 4) {
          events.push({
            date: parts[0],
            time: parts[1],
            event: parts[2],
            phone: parts[3],
            agent: parts[4] || '',
            params: parts[5] || ''
          });
        }
      }
      
      console.log(`📊 Parsed ${events.length} events from CSV`);
      
      // Group events by phone number to find PICK_UP + END pairs
      const phoneGroups = new Map();
      
      events.forEach(event => {
        if (!event.phone || event.phone === '""') return;
        
        const phone = event.phone.replace(/"/g, '');
        if (!phoneGroups.has(phone)) {
          phoneGroups.set(phone, []);
        }
        phoneGroups.get(phone).push(event);
      });
      
      console.log(`📞 Grouped events for ${phoneGroups.size} phone numbers`);
      
      // Find AO Connects (PICK_UP + END with 12+ second duration)
      const aoConnects = [];
      let validConnects = 0;
      
      phoneGroups.forEach((phoneEvents, phone) => {
        // Sort events by time for this phone number
        phoneEvents.sort((a, b) => {
          const timeA = new Date(`${a.date} ${a.time.replace(/"/g, '')}`).getTime();
          const timeB = new Date(`${b.date} ${b.time.replace(/"/g, '')}`).getTime();
          return timeA - timeB;
        });
        
        // Look for PICK_UP + END pairs
        for (let i = 0; i < phoneEvents.length - 1; i++) {
          const pickupEvent = phoneEvents[i];
          
          if (pickupEvent.event === '"PICK_UP"') {
            // Find corresponding END event
            for (let j = i + 1; j < phoneEvents.length; j++) {
              const endEvent = phoneEvents[j];
              
              if (endEvent.event === '"END"' && endEvent.agent === pickupEvent.agent) {
                // Calculate duration
                const pickupTime = new Date(`${pickupEvent.date} ${pickupEvent.time.replace(/"/g, '')}`).getTime();
                const endTime = new Date(`${endEvent.date} ${endEvent.time.replace(/"/g, '')}`).getTime();
                const durationSeconds = Math.floor((endTime - pickupTime) / 1000);
                
                // AO Connect = 12+ seconds
                if (durationSeconds >= 12) {
                  validConnects++;
                  
                  aoConnects.push({
                    phone,
                    agentId: pickupEvent.agent.replace(/"/g, ''),
                    pickupTime: pickupEvent.time,
                    endTime: endEvent.time,
                    durationSeconds,
                    billing: 8.00 // $8.00 per AO Connect
                  });
                }
                break; // Found the END event for this PICK_UP
              }
            }
          }
        }
      });
      
      console.log(`✅ Found ${validConnects} AO Connects with 12+ second duration`);
      
      // Get agent names from customers table using associate_id
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email');

      if (customerError) {
        console.error('❌ Error fetching customer data:', customerError);
      }

      // Create agent lookup map
      const agentLookup = new Map();
      customerData?.forEach(customer => {
        if (customer.associate_id) {
          agentLookup.set(customer.associate_id.toString(), {
            name: `${customer.first_name} ${customer.last_name}`,
            email: customer.company_email || `agent${customer.associate_id}@aoglobelife.com`
          });
        }
      });

      // Group AO Connects by agent
      const agentTotals = new Map();
      
      aoConnects.forEach(connect => {
        const agentInfo = agentLookup.get(connect.agentId) || {
          name: `Agent ${connect.agentId}`,
          email: `agent${connect.agentId}@aoglobelife.com`
        };

        if (!agentTotals.has(connect.agentId)) {
          agentTotals.set(connect.agentId, {
            agentEmail: agentInfo.email,
            agentName: agentInfo.name,
            associateId: connect.agentId,
            connectCount: 0,
            totalBilling: 0,
            date: new Date().toISOString().split('T')[0]
          });
        }

        const agent = agentTotals.get(connect.agentId);
        agent.connectCount++;
        agent.totalBilling += connect.billing;
      });

      const results = Array.from(agentTotals.values());
      
      console.log(`📊 Final results: ${results.length} agents with AO Connects`);
      results.forEach(agent => {
        console.log(`   ${agent.agentName}: ${agent.connectCount} connects = $${agent.totalBilling.toFixed(2)}`);
      });

      return results;
    } catch (error) {
      console.error('❌ Error processing CSV data:', error);
      throw error;
    }
  }

  /**
   * Generate AO Connect billing report using CSV data
   */
  static async generateCSVConnectReport(): Promise<string> {
    try {
      // Read the actual CSV file - use the most recent one
      const fs = require('fs');
      const path = require('path');
      const csvPath = path.join(process.cwd(), 'attached_assets', '844a93f5-b3a5-4fa2-a2a0-c76ca6383c5c_1756905021710.csv');
      
      console.log('🔥 Reading CSV file:', csvPath);
      const csvData = fs.readFileSync(csvPath, 'utf8');
      
      const aoConnects = await this.processCSVData(csvData);
      
      const csvHeader = 'Email,Agent Name,Associate ID,AO Connects,Total Billing,Date\n';
      const csvRows = aoConnects.map(record => {
        return `"${record.agentEmail}","${record.agentName}","${record.associateId}","${record.connectCount}","$${record.totalBilling.toFixed(2)}","${record.date}"`;
      }).join('\n');

      console.log('✅ CSV AO Connect billing report generated');
      return csvHeader + csvRows;
    } catch (error) {
      console.error('❌ Error generating CSV Connect report:', error);
      throw error;
    }
  }
}