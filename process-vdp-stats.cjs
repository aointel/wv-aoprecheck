#!/usr/bin/env node
/**
 * Process VDP CSV stats - Extract all required stats by market and by day
 */
const fs = require('fs');
const path = require('path');

// Parse CSV line with proper quote handling
function parseCsvLine(line, headers) {
  const values = [];
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
  
  const result = {};
  headers.forEach((header, index) => {
    result[header] = values[index] || '';
  });
  return result;
}

// Parse params JSON
function parseParams(paramsStr) {
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
function parseDateTime(dateStr, timeStr) {
  try {
    const fullDatetime = `${dateStr} ${timeStr}`;
    return new Date(fullDatetime);
  } catch (error) {
    return null;
  }
}

// Group events by phone number
function groupEventsByPhone(events) {
  const groups = {};
  
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
      return (timeA || 0) - (timeB || 0);
    });
  }
  
  return groups;
}

// Find connects (PICK_UP → END > 12 seconds OR CONNECT events for inbound)
function findConnects(phoneGroups, allEvents) {
  const connects = [];
  
  // First, handle CONNECT events (inbound calls - especially Globe Market)
  const connectEvents = allEvents.filter(e => e.Event === 'CONNECT' && e.Agent);
  for (const connectEvent of connectEvents) {
    // CONNECT events are inbound calls - they don't have Params usually
    // For Globe Market inbound, we need to infer from context or default to Globe Market
    // Try to find market from other events on the same date/agent
    let market = 'Globe Market'; // Default for inbound CONNECT
    
    // Try to find market from nearby events with same agent
    const sameDateEvents = allEvents.filter(e => 
      e.Date === connectEvent.Date && 
      e.Agent === connectEvent.Agent &&
      e.Params
    );
    for (const event of sameDateEvents) {
      const params = parseParams(event.Params);
      if (params.Market) {
        market = params.Market;
        break;
      }
    }
    
    connects.push({
      phone: connectEvent.Phone || 'INBOUND',
      agent: connectEvent.Agent,
      ringDuration: 0, // Inbound calls have no ring duration
      callDuration: 0, // Don't have END event for CONNECT
      market: market,
      leadId: null,
      firstName: '',
      lastName: '',
      newTime: '',
      pickupTime: connectEvent.Date + ' ' + connectEvent.Time,
      endTime: '',
      isInbound: true,
      date: connectEvent.Date
    });
  }
  
  // Now handle regular outbound connects (PICK_UP → END > 12 seconds)
  for (const [phone, events] of Object.entries(phoneGroups)) {
    // Skip if already counted as inbound CONNECT
    if (connects.some(c => c.phone === phone && c.isInbound)) continue;
    
    // Find market from any event for this phone
    let phoneMarket = 'Unknown';
    for (const event of events) {
      if (event.Params) {
        const params = parseParams(event.Params);
        if (params.Market) {
          phoneMarket = params.Market;
          break;
        }
      }
    }
    
    // Find NEW event, PICK_UP, and END events
    let newEvent = null;
    let pickupEvent = null;
    let endEvent = null;
    
    // First pass: find PICK_UP event
    for (const event of events) {
      if ((event.Event === 'PICK_UP' || event.Event === 'PICKED') && !pickupEvent) {
        pickupEvent = event;
        break;
      }
    }
    
    if (pickupEvent) {
      const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
      
      // Find the NEW event that comes BEFORE this PICK_UP
      for (const event of events) {
        const eventTime = parseDateTime(event.Date, event.Time);
        if (eventTime && pickupTime && eventTime <= pickupTime) {
          if (event.Event === 'NEW' || (event.Event === 'BLASTER' && !newEvent)) {
            if (!newEvent || (parseDateTime(newEvent.Date, newEvent.Time) < eventTime)) {
              newEvent = event;
            }
          }
        }
      }
      
      // If still no NEW event, use the first event for this phone
      if (!newEvent && events.length > 0) {
        newEvent = events[0];
      }
      
      // Find END event after PICK_UP
      for (const event of events) {
        if (event.Event === 'END' && !endEvent) {
          const eventTime = parseDateTime(event.Date, event.Time);
          if (eventTime && pickupTime && eventTime > pickupTime) {
            endEvent = event;
            break;
          }
        }
      }
    }
    
    // Only count as connect if we have PICK_UP and END, and call duration > 12 seconds
    if (pickupEvent && endEvent) {
      const pickupTime = parseDateTime(pickupEvent.Date, pickupEvent.Time);
      const endTime = parseDateTime(endEvent.Date, endEvent.Time);
      const newTime = newEvent ? parseDateTime(newEvent.Date, newEvent.Time) : null;
      
      if (pickupTime && endTime) {
        const callDurationSeconds = (endTime.getTime() - pickupTime.getTime()) / 1000;
        
        if (callDurationSeconds > 12) {
          // Calculate ring duration (NEW to PICK_UP)
          let ringDurationSeconds = 0;
          if (newTime && pickupTime) {
            ringDurationSeconds = (pickupTime.getTime() - newTime.getTime()) / 1000;
          }
          
          const params = parseParams(pickupEvent.Params);
          
          connects.push({
            phone: phone,
            agent: pickupEvent.Agent || 'UNASSIGNED',
            ringDuration: Math.round(ringDurationSeconds),
            callDuration: Math.round(callDurationSeconds),
            market: params.Market || phoneMarket,
            leadId: params.Leadid?.toString() || null,
            firstName: params['First Name'] || '',
            lastName: params['Last Name'] || '',
            newTime: newEvent ? (newEvent.Date + ' ' + newEvent.Time) : '',
            pickupTime: pickupEvent.Date + ' ' + pickupEvent.Time,
            endTime: endEvent.Date + ' ' + endEvent.Time,
            isInbound: false,
            date: pickupEvent.Date
          });
        }
      }
    }
  }
  
  return connects;
}

// Find missed calls and categorize them
function findMissedCalls(phoneGroups) {
  const missedCalls = [];
  const processedPhones = new Set();
  
  for (const [phone, events] of Object.entries(phoneGroups)) {
    if (processedPhones.has(phone)) continue;
    
    // Check if this phone had a PICK_UP - if so, it's not a missed call
    let hadPickup = false;
    for (const event of events) {
      if (event.Event === 'PICK_UP' || event.Event === 'PICKED' || event.Event === 'CONNECT') {
        hadPickup = true;
        break;
      }
    }
    
    if (hadPickup) continue; // Skip if it was picked up
    
    // Check for MISSED event
    let missedEvent = null;
    for (const event of events) {
      if (event.Event === 'MISSED') {
        missedEvent = event;
        break;
      }
    }
    
    // If no MISSED event but has NO_AGENT, still count as missed
    if (!missedEvent) {
      for (const event of events) {
        if (event.Event === 'NO_AGENT') {
          missedEvent = event;
          break;
        }
      }
    }
    
    if (missedEvent) {
      const params = parseParams(missedEvent.Params);
      
      // Check if there was a BLASTER event (agent was assigned)
      let hadBlaster = false;
      let agentId = null;
      for (const event of events) {
        if (event.Event === 'BLASTER' && event.Agent) {
          hadBlaster = true;
          agentId = event.Agent;
          break;
        }
      }
      
      // Get market
      let market = params.Market || 'Unknown';
      if (market === 'Unknown') {
        for (const event of events) {
          if (event.Params) {
            const p = parseParams(event.Params);
            if (p.Market) {
              market = p.Market;
              break;
            }
          }
        }
      }
      
      missedCalls.push({
        phone: phone,
        agent: agentId || missedEvent.Agent || 'UNASSIGNED',
        market: market,
        leadId: params.Leadid?.toString() || null,
        firstName: params['First Name'] || '',
        lastName: params['Last Name'] || '',
        event: missedEvent.Event,
        date: missedEvent.Date,
        time: missedEvent.Time,
        hadAgent: hadBlaster || (missedEvent.Agent && missedEvent.Agent.trim() !== '')
      });
      
      processedPhones.add(phone);
    }
  }
  
  return missedCalls;
}

// Main processing function
async function processVdpCsv(csvFilePath) {
  console.log('📊 Processing VDP CSV Stats...\n');
  console.log(`📄 File: ${csvFilePath}\n`);
  
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  console.log(`📄 Total rows: ${lines.length - 1}\n`);
  
  // Parse all events
  const events = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const event = parseCsvLine(lines[i], headers);
      if (event && (event.Phone || event.Event === 'CONNECT')) {
        events.push(event);
      }
    }
  }
  
  console.log(`✅ Parsed ${events.length} events\n`);
  
  // Group events by phone number
  const phoneGroups = groupEventsByPhone(events);
  
  // Find connects and missed calls
  const connects = findConnects(phoneGroups, events);
  const missedCalls = findMissedCalls(phoneGroups);
  
  console.log(`📞 Connects: ${connects.length}`);
  console.log(`❌ Missed Calls: ${missedCalls.length}\n`);
  
  // Initialize market stats (by date and market)
  const dailyMarketStats = {}; // date -> market -> stats
  const marketStats = {}; // Overall by market
  
  // Initialize all markets found in events
  for (const event of events) {
    const date = event.Date || 'Unknown';
    let market = 'Unknown';
    
    if (event.Params) {
      const params = parseParams(event.Params);
      market = params.Market || 'Unknown';
    } else if (event.Event === 'CONNECT') {
      // Inbound CONNECT events - default to Globe Market
      market = 'Globe Market';
    }
    
    // Initialize daily stats
    if (!dailyMarketStats[date]) {
      dailyMarketStats[date] = {};
    }
    if (!dailyMarketStats[date][market]) {
      dailyMarketStats[date][market] = {
        totalNew: 0,
        connects: 0,
        transferred: 0,
        agentAnswered: 0,
        totalRingDuration: 0,
        billed: 0,
        missedWithAgent: 0,
        missedNoAgent: 0,
        totalMissed: 0
      };
    }
    
    // Initialize overall market stats
    if (!marketStats[market]) {
      marketStats[market] = {
        totalNew: 0,
        connects: 0,
        transferred: 0,
        agentAnswered: 0,
        totalRingDuration: 0,
        billed: 0,
        missedWithAgent: 0,
        missedNoAgent: 0,
        totalMissed: 0
      };
    }
  }
  
  // Count NEW events by date and market
  for (const event of events) {
    if (event.Event === 'NEW') {
      const date = event.Date || 'Unknown';
      const params = parseParams(event.Params);
      const market = params.Market || 'Unknown';
      
      if (dailyMarketStats[date] && dailyMarketStats[date][market]) {
        dailyMarketStats[date][market].totalNew++;
      }
      if (marketStats[market]) {
        marketStats[market].totalNew++;
      }
    }
  }
  
  // Count CONNECT events (inbound) by date and market
  for (const event of events) {
    if (event.Event === 'CONNECT' && event.Agent) {
      const date = event.Date || 'Unknown';
      let market = 'Globe Market'; // Default for inbound
      
      // Try to find market from nearby events
      const sameDateEvents = events.filter(e => 
        e.Date === date && e.Agent === event.Agent && e.Params
      );
      for (const e of sameDateEvents) {
        const params = parseParams(e.Params);
        if (params.Market) {
          market = params.Market;
          break;
        }
      }
      
      if (dailyMarketStats[date] && dailyMarketStats[date][market]) {
        dailyMarketStats[date][market].connects++;
        dailyMarketStats[date][market].agentAnswered++;
        dailyMarketStats[date][market].billed++;
      }
      if (marketStats[market]) {
        marketStats[market].connects++;
        marketStats[market].agentAnswered++;
        marketStats[market].billed++;
      }
    }
  }
  
  // Count all PICK_UP events as "Agent Answered" by date and market
  const processedPickups = new Set(); // Track by phone+date to avoid double counting
  for (const event of events) {
    if ((event.Event === 'PICK_UP' || event.Event === 'PICKED') && !processedPickups.has(event.Phone + '|' + event.Date)) {
      const date = event.Date || 'Unknown';
      const params = parseParams(event.Params);
      const market = params.Market || 'Unknown';
      
      if (dailyMarketStats[date] && dailyMarketStats[date][market]) {
        dailyMarketStats[date][market].agentAnswered++;
      }
      if (marketStats[market]) {
        marketStats[market].agentAnswered++;
      }
      processedPickups.add(event.Phone + '|' + event.Date);
    }
  }
  
  // Process connects by date and market
  for (const connect of connects) {
    const date = connect.date || 'Unknown';
    const market = connect.market || 'Unknown';
    
    if (dailyMarketStats[date] && dailyMarketStats[date][market]) {
      if (!connect.isInbound) {
        // Only increment if not already counted as CONNECT
        dailyMarketStats[date][market].connects++;
        dailyMarketStats[date][market].totalRingDuration += connect.ringDuration;
        dailyMarketStats[date][market].billed++;
      }
    }
    if (marketStats[market]) {
      if (!connect.isInbound) {
        marketStats[market].connects++;
        marketStats[market].totalRingDuration += connect.ringDuration;
        marketStats[market].billed++;
      }
    }
  }
  
  // Process missed calls by date and market
  for (const missed of missedCalls) {
    const date = missed.date || 'Unknown';
    const market = missed.market || 'Unknown';
    
    if (dailyMarketStats[date] && dailyMarketStats[date][market]) {
      dailyMarketStats[date][market].totalMissed++;
      if (missed.hadAgent) {
        dailyMarketStats[date][market].missedWithAgent++;
      } else {
        dailyMarketStats[date][market].missedNoAgent++;
      }
    }
    if (marketStats[market]) {
      marketStats[market].totalMissed++;
      if (missed.hadAgent) {
        marketStats[market].missedWithAgent++;
      } else {
        marketStats[market].missedNoAgent++;
      }
    }
  }
  
  // Display DAILY breakdown by market
  console.log('='.repeat(120));
  console.log('📅 DAILY STATS BY MARKET');
  console.log('='.repeat(120));
  console.log();
  
  const sortedDates = Object.keys(dailyMarketStats).sort();
  
  for (const date of sortedDates) {
    console.log(`\n📆 DATE: ${date}`);
    console.log('-'.repeat(120));
    
    const marketsForDate = Object.keys(dailyMarketStats[date]);
    const sortedMarkets = marketsForDate.sort((a, b) => {
      return (dailyMarketStats[date][b].totalNew || 0) - (dailyMarketStats[date][a].totalNew || 0);
    });
    
    // Header for this date
    console.log('Market'.padEnd(20) + 
                'NEW'.padStart(8) +
                'Connected'.padStart(12) +
                'Agent Ans'.padStart(12) +
                'Billed'.padStart(10) +
                'Ring Dur'.padStart(10) +
                'Missed Ag'.padStart(12) +
                'Missed NO'.padStart(12) +
                'Total Miss'.padStart(12));
    console.log('-'.repeat(120));
    
    for (const market of sortedMarkets) {
      const stats = dailyMarketStats[date][market];
      if (stats.totalNew === 0 && stats.connects === 0 && stats.totalMissed === 0) continue;
      
      const avgRing = stats.connects > 0 ? (stats.totalRingDuration / stats.connects).toFixed(1) : '0.0';
      
      console.log(market.substring(0, 19).padEnd(20) +
                  (stats.totalNew || 0).toString().padStart(8) +
                  (stats.connects || 0).toString().padStart(12) +
                  (stats.agentAnswered || 0).toString().padStart(12) +
                  (stats.billed || 0).toString().padStart(10) +
                  avgRing.padStart(10) +
                  (stats.missedWithAgent || 0).toString().padStart(12) +
                  (stats.missedNoAgent || 0).toString().padStart(12) +
                  (stats.totalMissed || 0).toString().padStart(12));
    }
  }
  
  console.log('\n\n');
  
  // Display overall stats by market
  console.log('='.repeat(100));
  console.log('📊 OVERALL STATS BY MARKET');
  console.log('='.repeat(100));
  console.log();
  
  // Sort markets by total NEW calls
  const sortedMarkets = Object.entries(marketStats).sort((a, b) => {
    return b[1].totalNew - a[1].totalNew;
  });
  
  // Header
  console.log('Market'.padEnd(20) + 
              'Connected'.padStart(12) +
              'Transferred'.padStart(12) +
              '% Trans'.padStart(10) +
              'Agent Ans'.padStart(12) +
              '% Ans'.padStart(10) +
              'Ring Dur'.padStart(12) +
              'Billed'.padStart(10) +
              '% Billed'.padStart(10) +
              'Missed Agent'.padStart(14) +
              '% Miss Ag'.padStart(12) +
              'Miss NO Ag'.padStart(14) +
              '% NO Ag'.padStart(12) +
              'Total Missed'.padStart(14) +
              '% Missed'.padStart(12));
  console.log('-'.repeat(100));
  
  for (const [market, stats] of sortedMarkets) {
    const pctTransferred = stats.connects > 0 ? ((stats.transferred / stats.connects) * 100).toFixed(1) : '0.0';
    const pctAnswered = stats.totalNew > 0 ? ((stats.agentAnswered / stats.totalNew) * 100).toFixed(1) : '0.0';
    const avgRingDuration = stats.connects > 0 ? (stats.totalRingDuration / stats.connects).toFixed(1) : '0.0';
    const pctBilled = stats.totalNew > 0 ? ((stats.billed / stats.totalNew) * 100).toFixed(1) : '0.0';
    const pctMissedAgent = stats.totalNew > 0 ? ((stats.missedWithAgent / stats.totalNew) * 100).toFixed(1) : '0.0';
    const pctMissedNoAgent = stats.totalNew > 0 ? ((stats.missedNoAgent / stats.totalNew) * 100).toFixed(1) : '0.0';
    const pctTotalMissed = stats.totalNew > 0 ? ((stats.totalMissed / stats.totalNew) * 100).toFixed(1) : '0.0';
    
    console.log(market.substring(0, 19).padEnd(20) +
                stats.connects.toString().padStart(12) +
                stats.transferred.toString().padStart(12) +
                pctTransferred.padStart(10) +
                stats.agentAnswered.toString().padStart(12) +
                pctAnswered.padStart(10) +
                avgRingDuration.padStart(12) +
                stats.billed.toString().padStart(10) +
                pctBilled.padStart(10) +
                stats.missedWithAgent.toString().padStart(14) +
                pctMissedAgent.padStart(12) +
                stats.missedNoAgent.toString().padStart(14) +
                pctMissedNoAgent.padStart(12) +
                stats.totalMissed.toString().padStart(14) +
                pctTotalMissed.padStart(12));
  }
  
  console.log();
}

// Run if called directly
if (require.main === module) {
  const csvFile = process.argv[2] || '3c9942a5-e49a-4f21-ba6f-0ad56db95487.csv';
  
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ Error: File not found: ${csvFile}`);
    process.exit(1);
  }
  
  processVdpCsv(csvFile).catch(error => {
    console.error('❌ Error processing CSV:', error);
    process.exit(1);
  });
}

module.exports = { processVdpCsv };
