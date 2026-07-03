// Create agent phone number mapping for Twilio attribution
import { db } from './server/db.ts';

const AGENT_PHONE_MAPPINGS = [
  // David's confirmed numbers
  { agent_email: 'davidfulfer@aoglobelife.com', phone_number: '+16052500834', source: 'twilio_direct' },
  { agent_email: 'davidfulfer@aoglobelife.com', phone_number: '+19142289324', source: 'twilio_direct' },
  
  // Need to identify other agent numbers from Twilio
  { agent_email: 'kingsleyibeh@aoglobelife.com', phone_number: 'UNKNOWN', source: 'needs_identification' },
  { agent_email: 'chrislafond@aoglobelife.com', phone_number: 'UNKNOWN', source: 'needs_identification' },
  { agent_email: 'martintoma@aoglobelife.com', phone_number: 'UNKNOWN', source: 'needs_identification' },
  { agent_email: 'tabithamcdermid@aoglobelife.com', phone_number: 'UNKNOWN', source: 'needs_identification' },
  { agent_email: 'fayesaad@aoglobelife.com', phone_number: 'UNKNOWN', source: 'needs_identification' }
];

async function createPhoneMappingTable() {
  try {
    console.log('🎯 Creating agent phone mapping table...');
    
    // Create the mapping table
    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_phone_mapping (
        id SERIAL PRIMARY KEY,
        agent_email VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        source VARCHAR(50) DEFAULT 'twilio',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent_email, phone_number)
      )
    `);
    
    // Insert known mappings
    for (const mapping of AGENT_PHONE_MAPPINGS) {
      if (mapping.phone_number !== 'UNKNOWN') {
        await db.query(`
          INSERT INTO agent_phone_mapping (agent_email, phone_number, source)
          VALUES ($1, $2, $3)
          ON CONFLICT (agent_email, phone_number) DO NOTHING
        `, [mapping.agent_email, mapping.phone_number, mapping.source]);
        
        console.log(`✅ Mapped ${mapping.phone_number} to ${mapping.agent_email}`);
      }
    }
    
    console.log('✅ Agent phone mapping table created successfully');
    
  } catch (error) {
    console.error('❌ Error creating phone mapping:', error);
  }
}

createPhoneMappingTable();