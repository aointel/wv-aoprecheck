import * as fs from 'fs';
import * as path from 'path';

async function insertVdpData() {
  const { Pool } = require('pg');
  const XLSX = require('xlsx');
  
  console.log('🚀 Inserting VDP connects and missed calls with hierarchy data...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // 1. Load hierarchy from Excel
    console.log('📊 Loading hierarchy from producer list...');
    const excelFilePath = path.join(process.cwd(), 'attached_assets', 'Producer List 9.5.25_1757177701952.xlsx');
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const producerData = XLSX.utils.sheet_to_json(worksheet);
    
    // Build hierarchy map
    const hierarchyMap = new Map();
    for (const record of producerData) {
      const agentId = record['Associate ID']?.toString();
      if (agentId) {
        hierarchyMap.set(agentId, {
          agentName: record['Agent'] || 'Unknown Agent',
          mga: record['MGA'] && record['MGA'] !== 0 ? record['MGA'].toString() : null,
          rga: record['RGA'] && record['RGA'] !== 0 ? record['RGA'].toString() : null
        });
      }
    }
    console.log(`✅ Loaded hierarchy for ${hierarchyMap.size} agents`);
    
    // 2. Process CSV data
    console.log('📄 Processing VDP CSV data...');
    const csvFilePath = path.join(process.cwd(), 'attached_assets', 'd0d9d3a8-6890-4796-9ca2-86d03d41108b_1757178015996.csv');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Parse events
    const events = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const parts = lines[i].split(',');
        if (parts.length >= 5) {
          events.push({
            date: parts[0],
            time: parts[1]?.replace(/"/g, ''),
            event: parts[2],
            phone: parts[3],
            agent: parts[4]?.replace(/"/g, ''),
            params: parts.slice(5).join(',')
          });
        }
      }
    }
    
    // Group by phone
    const phoneGroups = {};
    for (const event of events) {
      if (event.phone) {
        if (!phoneGroups[event.phone]) phoneGroups[event.phone] = [];
        phoneGroups[event.phone].push(event);
      }
    }
    
    // Sort each group by time
    for (const phone in phoneGroups) {
      phoneGroups[phone].sort((a, b) => {
        const timeA = new Date(`${a.date} ${a.time}`).getTime();
        const timeB = new Date(`${b.date} ${b.time}`).getTime();
        return timeA - timeB;
      });
    }
    
    // 3. Find connects (PICK_UP → END over 12 seconds)
    const connects = [];
    for (const [phone, phoneEvents] of Object.entries(phoneGroups)) {
      let pickupEvent = null;
      
      for (const event of phoneEvents) {
        if (event.event === 'PICK_UP' || event.event === 'PICKED') {
          pickupEvent = event;
        } else if (event.event === 'END' && pickupEvent) {
          const pickupTime = new Date(`${pickupEvent.date} ${pickupEvent.time}`);
          const endTime = new Date(`${event.date} ${event.time}`);
          const durationSeconds = (endTime.getTime() - pickupTime.getTime()) / 1000;
          
          if (durationSeconds > 12) {
            // Parse params for client info
            let clientName = 'Unknown Client';
            let leadId = null;
            let market = 'Unknown';
            
            try {
              const params = JSON.parse(pickupEvent.params || '{}');
              clientName = `${params['First Name'] || ''} ${params['Last Name'] || ''}`.trim() || 'Unknown Client';
              leadId = params['Leadid']?.toString() || null;
              market = params['Market'] || 'Unknown';
            } catch (error) {
              // Use defaults if params parsing fails
            }
            
            // Get hierarchy info
            const hierarchy = hierarchyMap.get(pickupEvent.agent) || {};
            
            connects.push({
              agentId: pickupEvent.agent,
              agentName: hierarchy.agentName || `Agent ${pickupEvent.agent}`,
              associateId: parseInt(pickupEvent.agent) || null,
              phoneNumber: phone,
              duration: Math.round(durationSeconds),
              clientName,
              leadId,
              market,
              mga: hierarchy.mga,
              rga: hierarchy.rga,
              connectDate: pickupEvent.date,
              pickupTime: pickupTime,
              endTime: endTime
            });
            break; // Only 1 charge per unique phone
          }
          pickupEvent = null;
        }
      }
    }
    
    // 4. Find missed calls (BLASTER over 10 seconds, NO PICK_UP)
    const missedCalls = [];
    for (const [phone, phoneEvents] of Object.entries(phoneGroups)) {
      let blasterEvent = null;
      let hadPickup = false;
      
      for (const event of phoneEvents) {
        if (event.event === 'BLASTER' && event.agent) {
          blasterEvent = event;
          hadPickup = false;
        } else if (event.event === 'PICK_UP' || event.event === 'PICKED') {
          hadPickup = true;
        }
      }
      
      if (blasterEvent && !hadPickup) {
        const blasterTime = new Date(`${blasterEvent.date} ${blasterEvent.time}`);
        const lastEvent = phoneEvents[phoneEvents.length - 1];
        const endTime = new Date(`${lastEvent.date} ${lastEvent.time}`);
        const durationSeconds = (endTime.getTime() - blasterTime.getTime()) / 1000;
        
        if (durationSeconds > 10) {
          // Parse params for client info
          let clientName = 'Unknown Client';
          let leadId = null;
          let market = 'Unknown';
          
          try {
            const params = JSON.parse(blasterEvent.params || '{}');
            clientName = `${params['First Name'] || ''} ${params['Last Name'] || ''}`.trim() || 'Unknown Client';
            leadId = params['Leadid']?.toString() || null;
            market = params['Market'] || 'Unknown';
          } catch (error) {
            // Use defaults if params parsing fails
          }
          
          // Get hierarchy info
          const hierarchy = hierarchyMap.get(blasterEvent.agent) || {};
          
          missedCalls.push({
            agentId: blasterEvent.agent,
            agentName: hierarchy.agentName || `Agent ${blasterEvent.agent}`,
            associateId: parseInt(blasterEvent.agent) || null,
            phoneNumber: phone,
            duration: 0, // Missed calls have 0 duration
            clientName,
            leadId,
            market,
            mga: hierarchy.mga,
            rga: hierarchy.rga,
            missedDate: blasterEvent.date,
            missedTime: blasterTime
          });
        }
      }
    }
    
    console.log(`📞 Found ${connects.length} connects to insert`);
    console.log(`❌ Found ${missedCalls.length} missed calls to insert`);
    
    // 5. Clear existing data and insert new data
    console.log('🗑️ Clearing existing VDP data...');
    await pool.query('DELETE FROM vdp_connects');
    await pool.query('DELETE FROM vdp_missed_calls');
    
    // Insert connects
    console.log('💾 Inserting connects...');
    for (const connect of connects) {
      await pool.query(`
        INSERT INTO vdp_connects (
          agent_id, agent_name, associate_id, phone_number, duration,
          client_name, lead_id, market, mga, rga, connect_date, pickup_time, end_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        connect.agentId, connect.agentName, connect.associateId, connect.phoneNumber,
        connect.duration, connect.clientName, connect.leadId, connect.market,
        connect.mga, connect.rga, connect.connectDate, connect.pickupTime, connect.endTime
      ]);
    }
    
    // Insert missed calls
    console.log('💾 Inserting missed calls...');
    for (const missed of missedCalls) {
      await pool.query(`
        INSERT INTO vdp_missed_calls (
          agent_id, agent_name, associate_id, phone_number, duration,
          client_name, lead_id, market, mga, rga, missed_date, missed_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        missed.agentId, missed.agentName, missed.associateId, missed.phoneNumber,
        missed.duration, missed.clientName, missed.leadId, missed.market,
        missed.mga, missed.rga, missed.missedDate, missed.missedTime
      ]);
    }
    
    console.log('✅ VDP data insertion completed!');
    
    // 6. Show summary by MGA team
    console.log('\n📊 VDP DATA BY MGA TEAM:');
    const mgaResults = await pool.query(`
      SELECT 
        COALESCE(mga, 'No MGA') as mga_name,
        COUNT(*) as connects,
        (SELECT COUNT(*) FROM vdp_missed_calls WHERE COALESCE(mga, 'No MGA') = COALESCE(vdp_connects.mga, 'No MGA')) as missed_calls
      FROM vdp_connects 
      GROUP BY mga 
      ORDER BY connects DESC
    `);
    
    for (const row of mgaResults.rows) {
      const total = parseInt(row.connects) + parseInt(row.missed_calls);
      const rate = total > 0 ? ((parseInt(row.connects) / total) * 100).toFixed(1) : 0;
      console.log(`🏢 ${row.mga_name}: ${row.connects} connects, ${row.missed_calls} missed (${rate}% rate)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

insertVdpData();