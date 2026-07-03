import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

export interface SimpleBillingRecord {
  agentId: string;
  agentName: string;
  agentEmail: string;
  aoConnects: number;
  totalBilling: number;
}

export class SimpleCsvBilling {
  /**
   * Process CSV and generate billing report
   */
  static async generateBillingReport(): Promise<string> {
    try {
      console.log('🔥 Starting CSV billing analysis...');
      
      // Read CSV file
      const csvPath = path.join(process.cwd(), 'attached_assets', 'f7a7c9cf-e1e6-4b51-bf50-4054052428de_1756960070202.csv');
      console.log(`📂 Reading CSV: ${csvPath}`);
      
      const csvData = fs.readFileSync(csvPath, 'utf8');
      const lines = csvData.split('\n').slice(1); // Skip header
      
      // Parse events
      const events: any[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split(',');
        if (parts.length >= 5) {
          events.push({
            date: parts[0],
            time: parts[1]?.replace(/"/g, ''),
            event: parts[2]?.replace(/"/g, ''),
            phone: parts[3]?.replace(/"/g, ''),
            agent: parts[4]?.replace(/"/g, '')
          });
        }
      }
      
      console.log(`📊 Parsed ${events.length} events`);
      
      // Find PICK_UP + END pairs with 12+ second duration
      const aoConnects = new Map<string, number>(); // agent -> count
      
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        if (event.event === 'PICK_UP' && event.phone && event.agent) {
          // Look for corresponding END event
          for (let j = i + 1; j < events.length; j++) {
            const endEvent = events[j];
            
            if (endEvent.event === 'END' && 
                endEvent.phone === event.phone && 
                endEvent.agent === event.agent) {
              
              // Calculate duration
              const pickupTime = new Date(`${event.date} ${event.time}`).getTime();
              const endTime = new Date(`${endEvent.date} ${endEvent.time}`).getTime();
              const durationSec = Math.floor((endTime - pickupTime) / 1000);
              
              // AO Connect = 12+ seconds
              if (durationSec >= 12) {
                const count = aoConnects.get(event.agent) || 0;
                aoConnects.set(event.agent, count + 1);
                console.log(`✅ AO Connect: Agent ${event.agent}, Duration: ${durationSec}s`);
              }
              
              break; // Found END for this PICK_UP
            }
          }
        }
      }
      
      console.log(`🎯 Found ${Array.from(aoConnects.values()).reduce((a, b) => a + b, 0)} AO Connects`);
      
      // Get agent names from customers table
      const { data: customers } = await supabase!
        .from('customers')
        .select('associate_id, first_name, last_name, company_email');
      
      const agentLookup = new Map<string, any>();
      customers?.forEach(c => {
        if (c.associate_id) {
          agentLookup.set(c.associate_id.toString(), {
            name: `${c.first_name} ${c.last_name}`,
            email: c.company_email || `agent${c.associate_id}@aoglobelife.com`
          });
        }
      });
      
      // Generate CSV report
      let csvReport = 'Agent ID,Agent Name,Email,AO Connects,Total Billing\n';
      
      for (const [agentId, connects] of Array.from(aoConnects.entries())) {
        const agent = agentLookup.get(agentId) || {
          name: `Agent ${agentId}`,
          email: `agent${agentId}@aoglobelife.com`
        };
        
        const billing = connects * 8.00; // $8.00 per AO Connect
        
        csvReport += `"${agentId}","${agent.name}","${agent.email}","${connects}","$${billing.toFixed(2)}"\n`;
        console.log(`💰 ${agent.name}: ${connects} connects = $${billing.toFixed(2)}`);
      }
      
      console.log('✅ Billing report generated successfully');
      return csvReport;
      
    } catch (error) {
      console.error('❌ Error generating billing report:', error);
      throw error;
    }
  }
}