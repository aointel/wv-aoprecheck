/**
 * ConnectNow Analytics Service
 * Processes CSV data to calculate KPIs for ConnectNow Analytics Dashboard
 * Organized by Market and Campaign Type using campaign IDs
 */

import * as fs from 'fs';
import * as path from 'path';
import { format, addDays } from 'date-fns';

// Campaign ID mappings
export const CAMPAIGN_MAPPINGS = {
  '68b754c3c28f053a2f7fe514': { market: 'Veteran', type: 'Inbound' },
  '67544a63e481235740fb4b73': { market: 'Veteran', type: 'Outbound' },
  '66c761e81e1037849aa6968f': { market: 'Globe Market', type: 'Outbound' },
  '68b77991c2401b0d72318ba4': { market: 'Globe Market', type: 'Inbound' },
  '68cc2498f67f5aeafec293cb': { market: 'aorecruit', type: 'Both' },
};

export interface KPIData {
  connected: number;
  transferred: number;
  percentTransferred: number;
  agentAnswered: number;
  percentAnswered: number;
  ringDuration: number; // Average in seconds
  billed: number;
  percentBilled: number;
  missedWithAgent: number;
  percentMissedAgent: number;
  missedNoAgent: number;
  percentMissedNoAgent: number;
  totalMissed: number;
  percentTotalMissed: number;
}

export interface CampaignKPIs {
  campaignId: string;
  market: string;
  campaignType: string;
  totalNew: number;
  kpis: KPIData;
}

export interface DailyReport {
  date: string;
  campaigns: CampaignKPIs[];
}

export interface DayKPIs {
  date: string;
  dayName: string;
  campaigns: CampaignKPIs[];
}

export interface WeeklyReport {
  weekStart: string; // Thursday
  weekEnd: string; // Wednesday
  days: DayKPIs[];
}

// Parse CSV line with proper quote handling
function parseCsvLine(line: string, headers: string[]): Record<string, string> {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  let fieldIndex = 0;
  let i = 0;
  
  while (i < line.length && fieldIndex < 5) {
    const char = line[i];
    if (char === '"' && (i === 0 || line[i-1] === ',')) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (i === line.length - 1 || line[i+1] === ',') {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      fieldIndex++;
      i++;
      continue;
    } else {
      currentValue += char;
    }
    i++;
  }
  
  // Everything remaining is the Params field
  if (i < line.length) {
    const paramsStr = line.substring(i).replace(/^,/, '');
    values.push(paramsStr);
  } else if (currentValue) {
    values.push(currentValue);
  } else {
    values.push('');
  }
  
  const result: Record<string, string> = {};
  headers.forEach((header, index) => {
    result[header] = values[index] || '';
  });
  return result;
}

// Parse params JSON
function parseParams(paramsStr: string): any {
  try {
    if (!paramsStr || paramsStr === '{}') return {};
    let cleaned = paramsStr.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    return JSON.parse(cleaned);
  } catch (error) {
    return {};
  }
}

// Parse date/time to timestamp
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const fullDatetime = `${dateStr} ${timeStr}`;
    return new Date(fullDatetime);
  } catch (error) {
    return null;
  }
}

// Get campaign info from persona field
function getCampaignInfo(persona: string | null | undefined): { market: string; type: string; campaignId: string } | null {
  if (!persona) return null;
  
  const mapping = CAMPAIGN_MAPPINGS[persona as keyof typeof CAMPAIGN_MAPPINGS];
  if (mapping) {
    return {
      market: mapping.market,
      type: mapping.type,
      campaignId: persona,
    };
  }
  
  return null;
}

// Group events by phone number
function groupEventsByPhone(events: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  for (const event of events) {
    if (event.Phone) {
      if (!groups[event.Phone]) {
        groups[event.Phone] = [];
      }
      groups[event.Phone].push(event);
    }
  }
  
  // Sort each group by date/time
  for (const phone in groups) {
    groups[phone].sort((a, b) => {
      const timeA = parseDateTime(a.Date, a.Time);
      const timeB = parseDateTime(b.Date, b.Time);
      return (timeA?.getTime() || 0) - (timeB?.getTime() || 0);
    });
  }
  
  return groups;
}

// Get phones that belong to a specific campaign
function getPhonesForCampaign(phoneGroups: Record<string, any[]>, campaignId: string, dateFilter?: string): Set<string> {
  const campaignPhones = new Set<string>();
  
  for (const [phone, events] of Object.entries(phoneGroups)) {
    // Filter by date first if provided
    const filteredEvents = dateFilter
      ? events.filter(e => e.Date === dateFilter)
      : events;
    
    // Check if any event for this phone has the persona matching the campaign
    for (const event of filteredEvents) {
      if (event.Params) {
        const params = parseParams(event.Params);
        const persona = params.persona || params.Persona;
        if (persona === campaignId) {
          campaignPhones.add(phone);
          break;
        }
      }
    }
  }
  
  return campaignPhones;
}

// Find connects for a specific campaign
function findConnectsForCampaign(phoneGroups: Record<string, any[]>, allEvents: any[], campaignId: string, dateFilter?: string): any[] {
  const connects: any[] = [];
  
  // Get all phones that belong to this campaign
  const campaignPhones = getPhonesForCampaign(phoneGroups, campaignId, dateFilter);
  
  // Handle CONNECT events (inbound calls) - check all events
  for (const event of allEvents) {
    if (event.Event === 'CONNECT' && event.Agent) {
      // Filter by date if provided
      if (dateFilter && event.Date !== dateFilter) continue;
      
      // Check if this CONNECT belongs to the campaign
      // First, check if Params has persona
      const params = parseParams(event.Params || '{}');
      let persona = params.persona || params.Persona;
      
      // If no persona in CONNECT event, try to find it by phone number
      if (!persona && event.Phone) {
        const phoneEvents = phoneGroups[event.Phone] || [];
        // Look for any event for this phone that has the campaign persona
        for (const phoneEvent of phoneEvents) {
          if (dateFilter && phoneEvent.Date !== dateFilter) continue;
          const phoneParams = parseParams(phoneEvent.Params || '{}');
          const phonePersona = phoneParams.persona || phoneParams.Persona;
          if (phonePersona === campaignId) {
            persona = phonePersona;
            break;
          }
        }
        
        // Also check if this phone is already in our campaign phones list
        if (!persona && campaignPhones.has(event.Phone)) {
          persona = campaignId; // If phone belongs to campaign, match it
        }
      }
      
      if (persona === campaignId) {
        const identifier = event.Phone || `${event.Date}_${event.Time}_${event.Agent}`;
        connects.push({
          phone: identifier,
          agent: event.Agent,
          ringDuration: 0,
          callDuration: 0,
          date: event.Date,
          isInbound: true,
        });
      }
    }
  }
  
  // Handle outbound connects (PICK_UP → END > 12 seconds) for campaign phones
  for (const phone of campaignPhones) {
    const events = phoneGroups[phone] || [];
    
    // Filter by date if provided
    const filteredEvents = dateFilter
      ? events.filter(e => e.Date === dateFilter)
      : events;
    
    if (filteredEvents.length === 0) continue;
    
    // Skip if already counted as inbound CONNECT
    const phoneIdentifier = phone;
    if (connects.some(c => (c.phone === phoneIdentifier || c.phone === phone) && c.isInbound)) continue;
    
    let pickupEvent = null;
    let endEvent = null;
    let newEvent = null;
    
    // Find PICK_UP event
    for (const event of filteredEvents) {
      if ((event.Event === 'PICK_UP' || event.Event === 'PICKED') && !pickupEvent) {
        pickupEvent = event;
        break;
      }
    }
    
    if (pickupEvent) {
      const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
      
      // Find NEW event before PICK_UP
      for (const event of filteredEvents) {
        const eventTime = parseDateTime(event.Date, event.Time);
        if (eventTime && pickupTime && eventTime <= pickupTime) {
          if (event.Event === 'NEW' || (event.Event === 'BLASTER' && !newEvent)) {
            if (!newEvent || (parseDateTime(newEvent.Date, newEvent.Time)?.getTime() || 0) < eventTime.getTime()) {
              newEvent = event;
            }
          }
        }
      }
      
      // Find END event after PICK_UP
      for (const event of filteredEvents) {
        if (event.Event === 'END' && !endEvent) {
          const eventTime = parseDateTime(event.Date, event.Time);
          if (eventTime && pickupTime && eventTime > pickupTime) {
            endEvent = event;
            break;
          }
        }
      }
      
      // Count as connect if PICK_UP + END with duration > 12 seconds
      if (pickupEvent && endEvent) {
        const pickupTimeObj = parseDateTime(pickupEvent.Date, pickupEvent.Time);
        const endTimeObj = parseDateTime(endEvent.Date, endEvent.Time);
        const newTimeObj = newEvent ? parseDateTime(newEvent.Date, newEvent.Time) : null;
        
        if (pickupTimeObj && endTimeObj) {
          const callDurationSeconds = (endTimeObj.getTime() - pickupTimeObj.getTime()) / 1000;
          
          if (callDurationSeconds > 12) {
            let ringDurationSeconds = 0;
            if (newTimeObj && pickupTimeObj) {
              ringDurationSeconds = (pickupTimeObj.getTime() - newTimeObj.getTime()) / 1000;
            }
            
            connects.push({
              phone: phone,
              agent: pickupEvent.Agent || 'UNASSIGNED',
              ringDuration: Math.round(ringDurationSeconds),
              callDuration: Math.round(callDurationSeconds),
              date: pickupEvent.Date,
              isInbound: false,
            });
          }
        }
      }
    }
  }
  
  return connects;
}

// Extract agent IDs from Agent column (6 digits each, can be multiple)
function extractAgentIds(agentColumn: string): string[] {
  if (!agentColumn || agentColumn.trim() === '') return [];
  
  // Agent IDs are 6 digits, can be separated by various delimiters
  const agentIdPattern = /\d{6}/g;
  const matches = agentColumn.match(agentIdPattern);
  return matches || [];
}

// Find missed calls for a specific campaign
function findMissedCallsForCampaign(phoneGroups: Record<string, any[]>, campaignId: string, dateFilter?: string): any[] {
  const missedCalls: any[] = [];
  
  // Get all phones that belong to this campaign
  const campaignPhones = getPhonesForCampaign(phoneGroups, campaignId, dateFilter);
  
  for (const phone of campaignPhones) {
    const events = phoneGroups[phone] || [];
    
    // Filter by date if provided
    const filteredEvents = dateFilter
      ? events.filter(e => e.Date === dateFilter)
      : events;
    
    if (filteredEvents.length === 0) continue;
    
    // Check if this phone had a PICK_UP event (if it gets answered, it's NOT missed)
    let hadPickup = false;
    for (const event of filteredEvents) {
      if (event.Event === 'PICK_UP') {
        hadPickup = true;
        break;
      }
    }
    
    // If call was answered, it's not a missed call
    if (hadPickup) continue;
    
    // Count BLASTER events (need at least 2 for missed with agent)
    const blasterEvents = filteredEvents.filter(e => e.Event === 'BLASTER');
    const hasAtLeastTwoBlasters = blasterEvents.length >= 2;
    
    // Extract agent IDs from all events (check Agent column in all events)
    const allAgentIds = new Set<string>();
    for (const event of filteredEvents) {
      if (event.Agent) {
        const agentIds = extractAgentIds(event.Agent);
        agentIds.forEach(id => allAgentIds.add(id));
      }
    }
    
    // Check for MISSED or NO_AGENT event
    let missedEvent = null;
    for (const event of filteredEvents) {
      if (event.Event === 'MISSED' || event.Event === 'NO_AGENT') {
        missedEvent = event;
        break;
      }
    }
    
    // If no MISSED/NO_AGENT event but has at least 2 BLASTER events, still count as missed
    if (missedEvent || hasAtLeastTwoBlasters) {
      const hasAgentData = allAgentIds.size > 0;
      
      if (hasAgentData && hasAtLeastTwoBlasters) {
        // Missed with Agent - count 1 miss per unique agent ID
        for (const agentId of allAgentIds) {
          missedCalls.push({
            phone: phone,
            agent: agentId,
            date: missedEvent?.Date || filteredEvents[0]?.Date || '',
            hadAgent: true,
          });
        }
      } else if (!hasAgentData) {
        // Missed No Agent
        missedCalls.push({
          phone: phone,
          agent: 'UNASSIGNED',
          date: missedEvent?.Date || filteredEvents[0]?.Date || '',
          hadAgent: false,
        });
      }
    }
  }
  
  return missedCalls;
}

/**
 * Process CSV file and calculate KPIs for all campaigns
 */
export async function processDailyReport(csvFilePath: string, dateFilter?: string): Promise<DailyReport> {
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  // Parse all events
  const events: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const event = parseCsvLine(lines[i], headers);
      if (event && (event.Phone || event.Event === 'CONNECT')) {
        // Filter by date if provided
        if (!dateFilter || event.Date === dateFilter) {
          events.push(event);
        }
      }
    }
  }
  
  // Group events by phone
  const phoneGroups = groupEventsByPhone(events);
  
  // Process each campaign
  const campaigns: CampaignKPIs[] = [];
  
  for (const [campaignId, mapping] of Object.entries(CAMPAIGN_MAPPINGS)) {
    // Count NEW events for this campaign
    const newEvents = events.filter(e => {
      if (e.Event !== 'NEW') return false;
      const params = parseParams(e.Params);
      const persona = params.persona || params.Persona;
      return persona === campaignId;
    });
    
    const totalNew = newEvents.length;
    
    // Find connects
    const connects = findConnectsForCampaign(phoneGroups, events, campaignId, dateFilter);
    
    // Find missed calls
    const missedCalls = findMissedCallsForCampaign(phoneGroups, campaignId, dateFilter);
    
    // Count agent answered - phones with PICK_UP event
    const agentAnsweredPhones = new Set<string>();
    
    // Get all phones that belong to this campaign
    const campaignPhones = getPhonesForCampaign(phoneGroups, campaignId, dateFilter);
    
    // Count phones with PICK_UP event
    for (const phone of campaignPhones) {
      const phoneEvents = phoneGroups[phone] || [];
      const filteredEvents = dateFilter
        ? phoneEvents.filter(e => e.Date === dateFilter)
        : phoneEvents;
      
      for (const event of filteredEvents) {
        if (event.Event === 'PICK_UP') {
          agentAnsweredPhones.add(phone);
          break; // Count each phone only once
        }
      }
    }
    
    const agentAnswered = agentAnsweredPhones.size;
    
    // Calculate ring durations for answered calls (NEW to PICK_UP)
    const ringDurations: number[] = [];
    for (const phone of agentAnsweredPhones) {
      const phoneEvents = phoneGroups[phone] || [];
      const filteredEvents = dateFilter
        ? phoneEvents.filter(e => e.Date === dateFilter)
        : phoneEvents;
      
      let pickupEvent = null;
      let newEvent = null;
      
      // Find PICK_UP event
      for (const event of filteredEvents) {
        if (event.Event === 'PICK_UP') {
          pickupEvent = event;
          break;
        }
      }
      
      if (pickupEvent) {
        const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
        
        // Find NEW event before PICK_UP
        for (const event of filteredEvents) {
          const eventTime = parseDateTime(event.Date, event.Time);
          if (eventTime && pickupTime && eventTime <= pickupTime) {
            if (event.Event === 'NEW') {
              if (!newEvent || (parseDateTime(newEvent.Date, newEvent.Time)?.getTime() || 0) < eventTime.getTime()) {
                newEvent = event;
              }
            }
          }
        }
        
        if (newEvent && pickupEvent) {
          const newTimeObj = parseDateTime(newEvent.Date, newEvent.Time);
          const pickupTimeObj = parseDateTime(pickupEvent.Date, pickupEvent.Time);
          if (newTimeObj && pickupTimeObj) {
            const ringDurationSeconds = (pickupTimeObj.getTime() - newTimeObj.getTime()) / 1000;
            if (ringDurationSeconds > 0) {
              ringDurations.push(ringDurationSeconds);
            }
          }
        }
      }
    }
    
    const avgRingDuration = ringDurations.length > 0
      ? ringDurations.reduce((sum, dur) => sum + dur, 0) / ringDurations.length
      : 0;
    
    // Calculate missed calls breakdown
    const missedWithAgent = missedCalls.filter(m => m.hadAgent).length;
    const missedNoAgent = missedCalls.filter(m => !m.hadAgent).length;
    const totalMissed = missedCalls.length;
    
    // Calculate Billed - answered calls with duration > 15 seconds
    const billedPhones = new Set<string>();
    for (const phone of campaignPhones) {
      const phoneEvents = phoneGroups[phone] || [];
      const filteredEvents = dateFilter
        ? phoneEvents.filter(e => e.Date === dateFilter)
        : phoneEvents;
      
      let pickupEvent = null;
      let endEvent = null;
      
      // Find PICK_UP event
      for (const event of filteredEvents) {
        if (event.Event === 'PICK_UP') {
          pickupEvent = event;
          break;
        }
      }
      
      if (pickupEvent) {
        const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
        
        // Find END event after PICK_UP
        for (const event of filteredEvents) {
          if (event.Event === 'END') {
            const endTime = parseDateTime(event.Date, event.Time);
            if (endTime && pickupTime && endTime > pickupTime) {
              endEvent = event;
              break;
            }
          }
        }
        
        // Count as billed if PICK_UP + END with duration > 15 seconds
        if (pickupEvent && endEvent) {
          const pickupTimeObj = parseDateTime(pickupEvent.Date, pickupEvent.Time);
          const endTimeObj = parseDateTime(endEvent.Date, endEvent.Time);
          
          if (pickupTimeObj && endTimeObj) {
            const callDurationSeconds = (endTimeObj.getTime() - pickupTimeObj.getTime()) / 1000;
            if (callDurationSeconds > 15) {
              billedPhones.add(phone);
            }
          }
        }
      }
    }
    
    const billed = billedPhones.size;
    
    // Calculate Transferred - unique phones with BLASTER events
    const transferredPhones = new Set<string>();
    for (const phone of campaignPhones) {
      const phoneEvents = phoneGroups[phone] || [];
      const filteredEvents = dateFilter
        ? phoneEvents.filter(e => e.Date === dateFilter)
        : phoneEvents;
      
      // If there's any BLASTER event, it's a transfer
      const hasBlaster = filteredEvents.some(e => e.Event === 'BLASTER');
      if (hasBlaster) {
        transferredPhones.add(phone);
      }
    }
    
    const transferred = transferredPhones.size;
    
    // Calculate KPIs
    const connected = 0; // Skip for now
    
    const kpis: KPIData = {
      connected,
      transferred,
      percentTransferred: connected > 0 ? (transferred / connected) * 100 : 0,
      agentAnswered,
      percentAnswered: totalNew > 0 ? (agentAnswered / totalNew) * 100 : 0,
      ringDuration: Math.round(avgRingDuration * 10) / 10,
      billed,
      percentBilled: totalNew > 0 ? (billed / totalNew) * 100 : 0,
      missedWithAgent,
      percentMissedAgent: totalNew > 0 ? (missedWithAgent / totalNew) * 100 : 0,
      missedNoAgent,
      percentMissedNoAgent: totalNew > 0 ? (missedNoAgent / totalNew) * 100 : 0,
      totalMissed,
      percentTotalMissed: totalNew > 0 ? (totalMissed / totalNew) * 100 : 0,
    };
    
    campaigns.push({
      campaignId,
      market: mapping.market,
      campaignType: mapping.type,
      totalNew,
      kpis,
    });
  }
  
  return {
    date: dateFilter || 'all',
    campaigns,
  };
}

/**
 * Get current PST date
 * Uses formatToParts to avoid toLocaleString parse bugs (e.g. hour "3" vs "15")
 */
function getPSTDate(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
  const pstYear = parseInt(get('year'), 10);
  const pstMonth = parseInt(get('month'), 10);
  const pstDay = parseInt(get('day'), 10);
  const pstHour = parseInt(get('hour'), 10);
  const pstMinute = parseInt(get('minute'), 10);
  const pstSecond = parseInt(get('second'), 10);
  return new Date(pstYear, pstMonth - 1, pstDay, pstHour, pstMinute, pstSecond);
}

/**
 * Get the current rolling week (Thursday to Wednesday PST)
 */
export function getCurrentRollingWeekPST(): { weekStart: Date; weekEnd: Date; days: Date[] } {
  const pstNow = getPSTDate();
  
  // Get day of week (0 = Sunday, 1 = Monday, ..., 4 = Thursday, 3 = Wednesday)
  const dayOfWeek = pstNow.getDay();
  
  // Calculate days to subtract to get to Thursday (4)
  let daysToSubtract = 0;
  if (dayOfWeek >= 4) {
    // Thursday (4) through Saturday (6)
    daysToSubtract = dayOfWeek - 4;
  } else {
    // Sunday (0) through Wednesday (3)
    daysToSubtract = dayOfWeek + 3;
  }
  
  // Get Thursday of current week
  const weekStart = new Date(pstNow);
  weekStart.setDate(pstNow.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  
  // Get Wednesday (6 days after Thursday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  // Generate all days in the week
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  
  return { weekStart, weekEnd, days };
}

/**
 * Format date to MM/DD/YYYY for CSV matching
 */
function formatDateForCSV(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Process weekly report with daily breakdowns
 */
export async function processWeeklyReport(csvFilePath: string): Promise<WeeklyReport> {
  const { weekStart, weekEnd, days } = getCurrentRollingWeekPST();
  
  // Read CSV file
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  // Parse all events
  const allEvents: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const event = parseCsvLine(lines[i], headers);
      if (event && (event.Phone || event.Event === 'CONNECT')) {
        allEvents.push(event);
      }
    }
  }
  
  // Process each day
  const dayReports: DayKPIs[] = [];
  
  for (const day of days) {
    const dayStr = formatDateForCSV(day);
    const dayName = format(day, 'EEEE'); // Full day name (Thursday, Friday, etc.)
    
    // Filter events for this day
    const dayEvents = allEvents.filter(e => e.Date === dayStr);
    
    // Group events by phone
    const phoneGroups = groupEventsByPhone(dayEvents);
    
    // Process each campaign for this day
    const campaigns: CampaignKPIs[] = [];
    
    for (const [campaignId, mapping] of Object.entries(CAMPAIGN_MAPPINGS)) {
      // Count NEW events for this campaign on this day
      const newEvents = dayEvents.filter(e => {
        if (e.Event !== 'NEW') return false;
        const params = parseParams(e.Params);
        const persona = params.persona || params.Persona;
        return persona === campaignId;
      });
      
      const totalNew = newEvents.length;
      
      // Find connects for this day
      const connects = findConnectsForCampaign(phoneGroups, dayEvents, campaignId, dayStr);
      
      // Find missed calls for this day
      const missedCalls = findMissedCallsForCampaign(phoneGroups, campaignId, dayStr);
      
      // Count agent answered - phones with PICK_UP event
      const agentAnsweredPhones = new Set<string>();
      const campaignPhones = getPhonesForCampaign(phoneGroups, campaignId, dayStr);
      
      for (const phone of campaignPhones) {
        const phoneEvents = phoneGroups[phone] || [];
        for (const event of phoneEvents) {
          if (event.Event === 'PICK_UP') {
            agentAnsweredPhones.add(phone);
            break;
          }
        }
      }
      
      const agentAnswered = agentAnsweredPhones.size;
      
      // Calculate Billed - answered calls with duration > 15 seconds
      const billedPhones = new Set<string>();
      for (const phone of campaignPhones) {
        const phoneEvents = phoneGroups[phone] || [];
        
        let pickupEvent = null;
        let endEvent = null;
        
        // Find PICK_UP event
        for (const event of phoneEvents) {
          if (event.Event === 'PICK_UP') {
            pickupEvent = event;
            break;
          }
        }
        
        if (pickupEvent) {
          const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
          
          // Find END event after PICK_UP
          for (const event of phoneEvents) {
            if (event.Event === 'END') {
              const endTime = parseDateTime(event.Date, event.Time);
              if (endTime && pickupTime && endTime > pickupTime) {
                endEvent = event;
                break;
              }
            }
          }
          
          // Count as billed if PICK_UP + END with duration > 15 seconds
          if (pickupEvent && endEvent) {
            const pickupTimeObj = parseDateTime(pickupEvent.Date, pickupEvent.Time);
            const endTimeObj = parseDateTime(endEvent.Date, endEvent.Time);
            
            if (pickupTimeObj && endTimeObj) {
              const callDurationSeconds = (endTimeObj.getTime() - pickupTimeObj.getTime()) / 1000;
              if (callDurationSeconds > 15) {
                billedPhones.add(phone);
              }
            }
          }
        }
      }
      
      const billed = billedPhones.size;
      
      // Calculate ring durations for answered calls (NEW to PICK_UP)
      const ringDurations: number[] = [];
      for (const phone of agentAnsweredPhones) {
        const phoneEvents = phoneGroups[phone] || [];
        
        let pickupEvent = null;
        let newEvent = null;
        
        // Find PICK_UP event
        for (const event of phoneEvents) {
          if (event.Event === 'PICK_UP') {
            pickupEvent = event;
            break;
          }
        }
        
        if (pickupEvent) {
          const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
          
          // Find NEW event before PICK_UP
          for (const event of phoneEvents) {
            const eventTime = parseDateTime(event.Date, event.Time);
            if (eventTime && pickupTime && eventTime <= pickupTime) {
              if (event.Event === 'NEW') {
                if (!newEvent || (parseDateTime(newEvent.Date, newEvent.Time)?.getTime() || 0) < eventTime.getTime()) {
                  newEvent = event;
                }
              }
            }
          }
          
          if (newEvent && pickupEvent) {
            const newTimeObj = parseDateTime(newEvent.Date, newEvent.Time);
            const pickupTimeObj = parseDateTime(pickupEvent.Date, pickupEvent.Time);
            if (newTimeObj && pickupTimeObj) {
              const ringDurationSeconds = (pickupTimeObj.getTime() - newTimeObj.getTime()) / 1000;
              if (ringDurationSeconds > 0) {
                ringDurations.push(ringDurationSeconds);
              }
            }
          }
        }
      }
      
      const avgRingDuration = ringDurations.length > 0
        ? ringDurations.reduce((sum, dur) => sum + dur, 0) / ringDurations.length
        : 0;
      
      // Calculate Transferred - unique phones with BLASTER events
      const transferredPhones = new Set<string>();
      for (const phone of campaignPhones) {
        const phoneEvents = phoneGroups[phone] || [];
        
        // If there's any BLASTER event, it's a transfer
        const hasBlaster = phoneEvents.some(e => e.Event === 'BLASTER');
        if (hasBlaster) {
          transferredPhones.add(phone);
        }
      }
      
      const transferred = transferredPhones.size;
      
      // Calculate missed calls breakdown
      const missedWithAgent = missedCalls.filter(m => m.hadAgent).length;
      const missedNoAgent = missedCalls.filter(m => !m.hadAgent).length;
      const totalMissed = missedCalls.length;
      
      // Calculate KPIs
      const connected = 0; // Skip for now
      
      const kpis: KPIData = {
        connected,
        transferred,
        percentTransferred: agentAnswered > 0 ? (transferred / agentAnswered) * 100 : 0,
        agentAnswered,
        percentAnswered: totalNew > 0 ? (agentAnswered / totalNew) * 100 : 0,
        ringDuration: Math.round(avgRingDuration * 10) / 10,
        billed,
        percentBilled: totalNew > 0 ? (billed / totalNew) * 100 : 0,
        missedWithAgent,
        percentMissedAgent: totalNew > 0 ? (missedWithAgent / totalNew) * 100 : 0,
        missedNoAgent,
        percentMissedNoAgent: totalNew > 0 ? (missedNoAgent / totalNew) * 100 : 0,
        totalMissed,
        percentTotalMissed: totalNew > 0 ? (totalMissed / totalNew) * 100 : 0,
      };
      
      campaigns.push({
        campaignId,
        market: mapping.market,
        campaignType: mapping.type,
        totalNew,
        kpis,
      });
    }
    
    dayReports.push({
      date: dayStr,
      dayName,
      campaigns,
    });
  }
  
  return {
    weekStart: formatDateForCSV(weekStart),
    weekEnd: formatDateForCSV(weekEnd),
    days: dayReports,
  };
}

