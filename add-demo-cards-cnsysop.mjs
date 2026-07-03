/**
 * Add demo AOI cards for cnsysop for testing
 * Run: node add-demo-cards-cnsysop.mjs
 * 
 * This script directly inserts demo connects into the war_connects table
 */

import pg from 'pg';
const { Pool } = pg;

// Database connection - adjust these if needed
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function addDemoCards() {
  const agentEmail = 'cnsysop@aoglobelife.com';
  const client = await pool.connect();
  
  try {
    console.log(`🎯 Adding 5 demo AOI cards for ${agentEmail}...`);
    
    const now = new Date();
    const demoCards = [
      {
        connect_id: `demo_${Date.now()}_1`,
        agent_email: agentEmail,
        lead_name: 'John Demo Smith',
        lead_phone: '5551234567',
        connect_date: now,
        connect_time: '14:30',
        duration: 300,
        lead_source: 'demo_cards',
        market: 'Veteran Demo',
        state: 'TX',
        connect_type: 'outbound',
        immediate_outcome: 'appointment_set',
        production_status: 'pending',
        follow_up_required: true,
        next_contact_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority_level: 'high',
        tags: JSON.stringify(['demo', 'test', 'aoi'])
      },
      {
        connect_id: `demo_${Date.now()}_2`,
        agent_email: agentEmail,
        lead_name: 'Jane Demo Wilson',
        lead_phone: '5551234568',
        connect_date: now,
        connect_time: '15:45',
        duration: 420,
        lead_source: 'demo_cards',
        market: 'Veteran Demo',
        state: 'FL',
        connect_type: 'outbound',
        immediate_outcome: 'presentation_completed',
        production_status: 'pending',
        follow_up_required: false,
        priority_level: 'medium',
        tags: JSON.stringify(['demo', 'test', 'aoi'])
      },
      {
        connect_id: `demo_${Date.now()}_3`,
        agent_email: agentEmail,
        lead_name: 'Mike Demo Johnson',
        lead_phone: '5551234569',
        connect_date: now,
        connect_time: '10:15',
        duration: 180,
        lead_source: 'demo_cards',
        market: 'Veteran Demo',
        state: 'CA',
        connect_type: 'outbound',
        immediate_outcome: 'callback_scheduled',
        production_status: 'pending',
        follow_up_required: true,
        next_contact_date: new Date(Date.now() + 48 * 60 * 60 * 1000),
        priority_level: 'low',
        tags: JSON.stringify(['demo', 'test', 'aoi'])
      },
      {
        connect_id: `demo_${Date.now()}_4`,
        agent_email: agentEmail,
        lead_name: 'Sarah Demo Davis',
        lead_phone: '5551234570',
        connect_date: now,
        connect_time: '09:30',
        duration: 600,
        lead_source: 'demo_cards',
        market: 'Veteran Demo',
        state: 'NY',
        connect_type: 'outbound',
        immediate_outcome: 'sale_completed',
        production_status: 'pending',
        follow_up_required: false,
        priority_level: 'high',
        tags: JSON.stringify(['demo', 'test', 'aoi', 'sale'])
      },
      {
        connect_id: `demo_${Date.now()}_5`,
        agent_email: agentEmail,
        lead_name: 'Robert Demo Taylor',
        lead_phone: '5551234571',
        connect_date: now,
        connect_time: '16:20',
        duration: 240,
        lead_source: 'demo_cards',
        market: 'Veteran Demo',
        state: 'OH',
        connect_type: 'outbound',
        immediate_outcome: 'not_interested',
        production_status: 'pending',
        follow_up_required: false,
        priority_level: 'low',
        tags: JSON.stringify(['demo', 'test', 'aoi'])
      }
    ];

    const insertedCards = [];
    
    for (const card of demoCards) {
      const query = `
        INSERT INTO war_connects (
          connect_id, agent_email, lead_name, lead_phone, connect_date, connect_time,
          duration, lead_source, market, state, connect_type, immediate_outcome,
          production_status, follow_up_required, next_contact_date, priority_level, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;
      
      const values = [
        card.connect_id,
        card.agent_email,
        card.lead_name,
        card.lead_phone,
        card.connect_date,
        card.connect_time,
        card.duration,
        card.lead_source,
        card.market,
        card.state,
        card.connect_type,
        card.immediate_outcome,
        card.production_status,
        card.follow_up_required,
        card.next_contact_date,
        card.priority_level,
        card.tags
      ];
      
      const result = await client.query(query, values);
      insertedCards.push(result.rows[0]);
      console.log(`   ✅ Added: ${card.lead_name} (${card.connect_id})`);
    }
    
    console.log(`\n✅ Successfully added ${insertedCards.length} demo AOI cards!`);
    console.log(`🎉 Visit /war-reports to see them in the Connect Card Deck.`);
    
  } catch (error) {
    console.error('❌ Failed to add demo cards:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addDemoCards();
