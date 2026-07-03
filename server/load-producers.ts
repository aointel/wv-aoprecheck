import { db } from "./storage";
import { producers } from "../shared/schema";

async function loadProducersFromExcel() {
  const XLSX = require('xlsx');
  const path = require('path');
  
  console.log('🚀 Loading ALL producer data from Excel...');
  
  try {
    // Load Excel file
    const excelFilePath = path.join(process.cwd(), 'attached_assets', 'Producer List 9.5.25_1757177701952.xlsx');
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📄 Found ${data.length} producer records`);
    
    // Clear existing data
    await db.delete(producers);
    console.log('🗑️ Cleared existing producer data');
    
    // Process and insert all records
    const producerRecords = [];
    let processed = 0;
    
    for (const record of data) {
      const associateId = record['Associate ID'];
      if (associateId && associateId !== 0) {
        producerRecords.push({
          associateId: parseInt(associateId.toString()),
          agentName: record['Agent'] || 'Unknown Agent',
          mga: record['MGA'] && record['MGA'] !== 0 ? record['MGA'].toString() : null,
          rga: record['RGA'] && record['RGA'] !== 0 ? record['RGA'].toString() : null,
          companyEmail: record['Company Email'] || null,
          personalEmail: record['Personal Email'] || null,
          phone: record['Phone'] ? record['Phone'].toString() : null,
          aoiMarket: record['AOI MARKET'] || null,
          designatedMarket: record['Designated Market'] || null,
          licensedStates: record['Life-and-Health Licensed States'] || null
        });
        processed++;
      }
    }
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < producerRecords.length; i += batchSize) {
      const batch = producerRecords.slice(i, i + batchSize);
      await db.insert(producers).values(batch);
      console.log(`💾 Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(producerRecords.length/batchSize)}`);
    }
    
    console.log(`✅ Successfully loaded ${processed} producer records!`);
    
    // Test some lookups
    console.log('🧪 Testing producer lookups...');
    
    const testIds = [67222, 194954, 409, 124235, 3, 126];
    for (const id of testIds) {
      const producer = await db.select().from(producers).where(sql`associate_id = ${id}`).limit(1);
      if (producer.length > 0) {
        const p = producer[0];
        console.log(`👤 ${p.agentName} (${p.associateId}): MGA=${p.mga || 'None'}, RGA=${p.rga || 'None'}, Email=${p.companyEmail}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error loading producers:', error);
  }
}

// Import sql from drizzle-orm
import { sql } from "drizzle-orm";

loadProducersFromExcel();