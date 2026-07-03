import { supabaseAdmin } from "./supabase";
import * as fs from 'fs';
import * as path from 'path';

interface CsvEvent {
  Date: string;
  Time: string;
  Event: string;
  Phone: string;
  Agent: string;
  Params: string;
}

interface ParsedParams {
  "First Name"?: string;
  "Last Name"?: string;
  Market?: string;
  Leadid?: number;
  AsscociateId?: string;
  [key: string]: any;
}

export class CsvDataProcessor {
  private hierarchyMap: Map<string, { mga: string | null; rga: string | null }> = new Map();
  
  /**
   * Process the CSV file and populate VDP tables
   */
  async processCsvFile(csvFilePath: string): Promise<void> {
    console.log('📊 Starting CSV data processing...');
    
    // First, load hierarchy data from producer table
    await this.loadHierarchyFromDatabase();
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    console.log(`📄 Processing ${lines.length - 1} CSV rows...`);
    
    // Parse all events
    const events: CsvEvent[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const event = this.parseCsvLine(lines[i], headers);
        if (event) events.push(event);
      }
    }
    
    console.log(`✅ Parsed ${events.length} events from CSV`);
    
    // Group events by phone number for connect analysis
    const phoneGroups = this.groupEventsByPhone(events);
    
    // Process connects and missed calls
    const connects = this.findConnects(phoneGroups);
    const missedCalls = this.findMissedCalls(events);
    
    console.log(`📞 Found ${connects.length} connects`);
    console.log(`❌ Found ${missedCalls.length} missed calls`);
    
    // Show agent team breakdown
    this.showAgentTeamBreakdown(connects, missedCalls);
    
    // Insert data into database
    await this.insertConnects(connects);
    await this.insertMissedCalls(missedCalls);
    
    console.log('✅ CSV data processing completed!');
  }
  
  /**
   * Parse a CSV line into an event object
   */
  private parseCsvLine(line: string, headers: string[]): CsvEvent | null {
    try {
      // Handle CSV parsing with proper quote handling
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] === ',')) {
          inQuotes = true;
        } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
          inQuotes = false;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue);
          currentValue = '';
          i++;
          continue;
        } else {
          currentValue += char;
        }
        i++;
      }
      values.push(currentValue); // Add last value
      
      const event: CsvEvent = {
        Date: values[0] || '',
        Time: values[1] || '',
        Event: values[2] || '',
        Phone: values[3] || '',
        Agent: values[4] || '',
        Params: values[5] || '{}'
      };
      
      return event;
    } catch (error) {
      console.error('Error parsing CSV line:', error);
      return null;
    }
  }
  
  /**
   * Group events by phone number
   */
  private groupEventsByPhone(events: CsvEvent[]): Record<string, CsvEvent[]> {
    const groups: Record<string, CsvEvent[]> = {};
    
    for (const event of events) {
      if (event.Phone) {
        if (!groups[event.Phone]) groups[event.Phone] = [];
        groups[event.Phone].push(event);
      }
    }
    
    // Sort each group by date/time
    for (const phone in groups) {
      groups[phone].sort((a, b) => {
        const timeA = new Date(`${a.Date} ${a.Time}`).getTime();
        const timeB = new Date(`${b.Date} ${b.Time}`).getTime();
        return timeA - timeB;
      });
    }
    
    return groups;
  }
  
  /**
   * Find connects: PICK_UP → END sequences over 12 seconds
   */
  private findConnects(phoneGroups: Record<string, CsvEvent[]>): any[] {
    const connects: any[] = [];
    
    for (const [phone, events] of Object.entries(phoneGroups)) {
      let pickupEvent: CsvEvent | null = null;
      
      for (const event of events) {
        if (event.Event === 'PICK_UP' || event.Event === 'PICKED') {
          pickupEvent = event;
        } else if (event.Event === 'END' && pickupEvent) {
          // Calculate duration
          const pickupTime = new Date(`${pickupEvent.Date} ${pickupEvent.Time}`);
          const endTime = new Date(`${event.Date} ${event.Time}`);
          const durationSeconds = (endTime.getTime() - pickupTime.getTime()) / 1000;
          
          // AOI connect = over 12 seconds
          if (durationSeconds > 12) {
            const params = this.parseParams(pickupEvent.Params);
            const agentInfo = this.extractAgentInfo(pickupEvent.Agent, params);
            
            connects.push({
              agentId: pickupEvent.Agent,
              agentName: agentInfo.agentName,
              associateId: agentInfo.associateId,
              phoneNumber: phone,
              duration: Math.round(durationSeconds),
              clientName: agentInfo.clientName,
              leadId: params.Leadid?.toString() || null,
              market: params.Market || 'Unknown',
              mga: agentInfo.mga,
              rga: agentInfo.rga,
              connectDate: pickupEvent.Date,
              pickupTime: pickupTime,
              endTime: endTime
            });
            
            break; // Only 1 charge per unique phone number
          }
          pickupEvent = null;
        }
      }
    }
    
    return connects;
  }
  
  /**
   * Find missed calls: MISSED, NO_AGENT events
   */
  private findMissedCalls(events: CsvEvent[]): any[] {
    const missedCalls: any[] = [];
    const processedPhones = new Set<string>(); // Track to avoid duplicates
    
    for (const event of events) {
      if ((event.Event === 'MISSED' || event.Event === 'NO_AGENT') && 
          !processedPhones.has(event.Phone)) {
        
        const params = this.parseParams(event.Params);
        const agentInfo = this.extractAgentInfo(event.Agent, params);
        const missedTime = new Date(`${event.Date} ${event.Time}`);
        
        missedCalls.push({
          agentId: event.Agent || 'UNASSIGNED',
          agentName: agentInfo.agentName,
          associateId: agentInfo.associateId,
          phoneNumber: event.Phone,
          duration: 0,
          clientName: agentInfo.clientName,
          leadId: params.Leadid?.toString() || null,
          market: params.Market || 'Unknown',
          mga: agentInfo.mga,
          rga: agentInfo.rga,
          missedDate: event.Date,
          missedTime: missedTime
        });
        
        processedPhones.add(event.Phone);
      }
    }
    
    return missedCalls;
  }
  
  /**
   * Parse params JSON string
   */
  private parseParams(paramsStr: string): ParsedParams {
    try {
      if (!paramsStr || paramsStr === '{}') return {};
      return JSON.parse(paramsStr);
    } catch (error) {
      console.error('Error parsing params:', error);
      return {};
    }
  }
  
  /**
   * Extract agent info and hierarchy
   */
  private extractAgentInfo(agentId: string, params: ParsedParams): {
    agentName: string;
    associateId: number | null;
    clientName: string;
    mga: string | null;
    rga: string | null;
  } {
    const firstName = params["First Name"] || '';
    const lastName = params["Last Name"] || '';
    const clientName = `${firstName} ${lastName}`.trim();
    
    // For now, set MGA/RGA based on agent patterns - you'll need to provide the mapping
    let mga: string | null = null;
    let rga: string | null = null;
    
    // Extract associate ID from params if available
    const associateId = params.AsscociateId ? parseInt(params.AsscociateId) : null;
    
    // TODO: Add your MGA/RGA mapping logic here based on agent hierarchy
    // For now, setting defaults
    if (agentId) {
      // Example hierarchy mapping - replace with actual logic
      mga = this.getMgaForAgent(agentId);
      rga = this.getRgaForAgent(agentId);
    }
    
    return {
      agentName: agentId ? `Agent ${agentId}` : 'Unknown Agent',
      associateId,
      clientName,
      mga,
      rga
    };
  }
  
  /**
   * Load hierarchy from database
   */
  async loadHierarchyFromDatabase(): Promise<void> {
    try {
      // Use Supabase to query producer data
      const { data, error } = await supabaseAdmin
        .from('producers')
        .select('associate_id, mga, rga');
      
      if (error) {
        throw error;
      }
      
      // Build hierarchy map
      for (const row of data || []) {
        const agentId = row.associate_id?.toString();
        if (agentId) {
          this.hierarchyMap.set(agentId, {
            mga: row.mga,
            rga: row.rga
          });
        }
      }
      
      console.log(`✅ Loaded hierarchy for ${this.hierarchyMap.size} agents from Supabase`);
      
    } catch (error) {
      console.error('❌ Error loading hierarchy from Supabase:', error);
      // Continue without hierarchy - MGA/RGA will be null
      console.log('⚠️ Continuing without hierarchy data...');
    }
  }

  /**
   * Load hierarchy from Excel file (fallback)
   */
  async loadHierarchyFromExcel(): Promise<void> {
    const XLSX = require('xlsx');
    const path = require('path');
    
    try {
      const excelFilePath = path.join(process.cwd(), 'attached_assets', 'Producer List 9.5.25_1757177701952.xlsx');
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Build hierarchy map
      for (const record of data) {
        const agentId = record['Associate ID']?.toString();
        if (agentId) {
          this.hierarchyMap.set(agentId, {
            mga: record['MGA'] && record['MGA'] !== 0 ? record['MGA'].toString() : null,
            rga: record['RGA'] && record['RGA'] !== 0 ? record['RGA'].toString() : null
          });
        }
      }
      
      console.log(`✅ Loaded hierarchy for ${this.hierarchyMap.size} agents from Excel`);
      
    } catch (error) {
      console.error('❌ Error loading hierarchy from Excel:', error);
    }
  }

  /**
   * Show agent team breakdown
   */
  showAgentTeamBreakdown(connects: any[], missedCalls: any[]): void {
    console.log('\n📊 AGENT TEAM BREAKDOWN:');
    console.log('=' * 50);
    
    // Group by MGA teams
    const mgaTeams: Record<string, { connects: number; missed: number; agents: Set<string> }> = {};
    
    // Process connects
    for (const connect of connects) {
      const mga = connect.mga || 'No MGA';
      if (!mgaTeams[mga]) {
        mgaTeams[mga] = { connects: 0, missed: 0, agents: new Set() };
      }
      mgaTeams[mga].connects++;
      mgaTeams[mga].agents.add(connect.agentId);
    }
    
    // Process missed calls
    for (const missed of missedCalls) {
      const mga = missed.mga || 'No MGA';
      if (!mgaTeams[mga]) {
        mgaTeams[mga] = { connects: 0, missed: 0, agents: new Set() };
      }
      mgaTeams[mga].missed++;
      mgaTeams[mga].agents.add(missed.agentId);
    }
    
    // Display results
    for (const [mga, stats] of Object.entries(mgaTeams)) {
      console.log(`\n🏢 MGA: ${mga}`);
      console.log(`   📞 Connects: ${stats.connects}`);
      console.log(`   ❌ Missed: ${stats.missed}`);
      console.log(`   👥 Agents: ${stats.agents.size}`);
      console.log(`   📈 Connect Rate: ${stats.connects > 0 ? ((stats.connects / (stats.connects + stats.missed)) * 100).toFixed(1) : 0}%`);
    }
    
    console.log(`\n📊 OVERALL TOTALS:`);
    console.log(`   📞 Total Connects: ${connects.length}`);
    console.log(`   ❌ Total Missed: ${missedCalls.length}`);
    console.log(`   📈 Overall Connect Rate: ${connects.length > 0 ? ((connects.length / (connects.length + missedCalls.length)) * 100).toFixed(1) : 0}%`);
  }

  /**
   * Get MGA for agent
   */
  private getMgaForAgent(agentId: string): string | null {
    return this.hierarchyMap.get(agentId)?.mga || null;
  }
  
  /**
   * Get RGA for agent
   */
  private getRgaForAgent(agentId: string): string | null {
    return this.hierarchyMap.get(agentId)?.rga || null;
  }
  
  /**
   * Insert connects into database
   */
  private async insertConnects(connects: any[]): Promise<void> {
    if (connects.length === 0) return;
    
    console.log(`💾 Inserting ${connects.length} connects...`);
    
    try {
      const { error } = await supabaseAdmin
        .from('vdp_connects')
        .insert(connects);
      
      if (error) {
        console.error('❌ Error inserting connects:', error);
      } else {
        console.log('✅ Connects inserted successfully');
      }
    } catch (error) {
      console.error('❌ Error inserting connects:', error);
    }
  }
  
  /**
   * Insert missed calls into database
   */
  private async insertMissedCalls(missedCalls: any[]): Promise<void> {
    if (missedCalls.length === 0) return;
    
    console.log(`💾 Inserting ${missedCalls.length} missed calls...`);
    
    try {
      const { error } = await supabaseAdmin
        .from('vdp_missed_calls')
        .insert(missedCalls);
      
      if (error) {
        console.error('❌ Error inserting missed calls:', error);
      } else {
        console.log('✅ Missed calls inserted successfully');
      }
    } catch (error) {
      console.error('❌ Error inserting missed calls:', error);
    }
  }
}

// Export singleton
export const csvDataProcessor = new CsvDataProcessor();