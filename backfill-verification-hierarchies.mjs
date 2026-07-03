/**
 * Backfill verification sessions with missing MGA/RGA hierarchy data
 * Finds all sessions missing agent_mga_team or agent_rga_team and fills them in
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get associate_id from email (try customers/producerlist)
async function getAssociateIdFromEmail(email) {
  if (!email || !supabase) return null;
  
  try {
    // Try customers table first
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('associate_id')
      .eq('company_email', email.toLowerCase())
      .maybeSingle();
    
    if (!customerError && customer?.associate_id) {
      return customer.associate_id;
    }
    
    // Try producerlist table
    const { data: producer, error: producerError } = await supabase
      .from('producerlist')
      .select('associate_id')
      .eq('company_email', email.toLowerCase())
      .maybeSingle();
    
    if (!producerError && producer?.associate_id) {
      return producer.associate_id;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to get agent hierarchy (same logic as getAgentHierarchyFromSupabase)
async function getAgentHierarchy(associateId, email, firstName, lastName) {
  if (!supabase) return null;
  
  try {
    // If we have associate_id, use it
    if (associateId) {
      const query = supabase
        .from("agent_hierarchy")
        .select("agent_associate_id, agent_name, agent_email, mga_name, rga_name, mga_associate_id, rga_associate_id")
        .eq("agent_associate_id", associateId)
        .limit(1);
      
      const { data, error } = await query.maybeSingle();
      
      if (!error && data) {
        return {
          associateId: data.agent_associate_id,
          email: data.agent_email,
          mga: data.mga_name,
          rga: data.rga_name,
          mgaAssociateId: data.mga_associate_id,
          rgaAssociateId: data.rga_associate_id
        };
      }
    }
    
    // Try by email
    if (email) {
      const query = supabase
        .from("agent_hierarchy")
        .select("agent_associate_id, agent_name, agent_email, mga_name, rga_name, mga_associate_id, rga_associate_id")
        .eq("agent_email", email.toLowerCase())
        .limit(1);
      
      const { data, error } = await query.maybeSingle();
      
      if (!error && data) {
        return {
          associateId: data.agent_associate_id,
          email: data.agent_email,
          mga: data.mga_name,
          rga: data.rga_name,
          mgaAssociateId: data.mga_associate_id,
          rgaAssociateId: data.rga_associate_id
        };
      }
    }
    
    // If we have name but no email/associate_id, try to get associate_id from customers/producerlist first
    if (email && !associateId) {
      const foundAssociateId = await getAssociateIdFromEmail(email);
      if (foundAssociateId) {
        // Retry with the found associate_id
        const query = supabase
          .from("agent_hierarchy")
          .select("agent_associate_id, agent_name, agent_email, mga_name, rga_name, mga_associate_id, rga_associate_id")
          .eq("agent_associate_id", foundAssociateId)
          .limit(1);
        
        const { data, error } = await query.maybeSingle();
        
        if (!error && data) {
          return {
            associateId: data.agent_associate_id,
            email: data.agent_email,
            mga: data.mga_name,
            rga: data.rga_name,
            mgaAssociateId: data.mga_associate_id,
            rgaAssociateId: data.rga_associate_id
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("❌ Supabase hierarchy lookup failed:", error);
    return null;
  }
}

// Helper to get MGA/RGA name from directory by associate_id
async function getMgaRgaNameFromDirectory(associateId) {
  if (!associateId || !supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('mga_rga_directory')
      .select('name, role')
      .eq('associate_id', associateId)
      .maybeSingle();
    
    if (error || !data) return null;
    
    return data.name;
  } catch (error) {
    return null;
  }
}

async function backfillVerificationHierarchies() {
  console.log('\n🚀 BACKFILLING VERIFICATION SESSIONS WITH MISSING HIERARCHIES');
  console.log('═'.repeat(80));
  
  try {
    // 1. Fetch all verification sessions missing MGA or RGA team
    console.log('\n📥 Fetching verification sessions missing hierarchies...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('verification_sessions')
      .select('id, associate_id, company_email, agent_first_name, agent_last_name, agent_mga_team, agent_rga_team, created_at')
      .or('agent_mga_team.is.null,agent_rga_team.is.null')
      .order('created_at', { ascending: false });
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions missing hierarchies!');
      return;
    }
    
    console.log(`✅ Found ${sessions.length} sessions missing MGA/RGA data`);
    
    // 2. Process sessions in batches
    console.log('\n🔄 Backfilling sessions...');
    console.log('═'.repeat(80));
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sessions.length / BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} sessions)...`);
      
      for (const session of batch) {
        // Skip if already has both MGA and RGA
        if (session.agent_mga_team && session.agent_rga_team) {
          skippedCount++;
          continue;
        }
        
        // Get hierarchy data
        const hierarchyMatch = await getAgentHierarchy(
          session.associate_id?.toString(),
          session.company_email,
          session.agent_first_name,
          session.agent_last_name
        );
        
        if (!hierarchyMatch) {
          notFoundCount++;
          if (notFoundCount <= 20) {
            console.log(`⚠️  Session ${session.id}: Agent not found (Associate ID: ${session.associate_id}, Email: ${session.company_email})`);
          }
          continue;
        }
        
        // Get MGA/RGA names - prioritize from hierarchy, fallback to directory
        let mgaName = hierarchyMatch.mga || null;
        let rgaName = hierarchyMatch.rga || null;
        
        // If hierarchy has associate IDs but no names, try directory lookup
        if (!mgaName && hierarchyMatch.mgaAssociateId) {
          mgaName = await getMgaRgaNameFromDirectory(hierarchyMatch.mgaAssociateId);
        }
        
        if (!rgaName && hierarchyMatch.rgaAssociateId) {
          rgaName = await getMgaRgaNameFromDirectory(hierarchyMatch.rgaAssociateId);
        }
        
        // Only update if we have new data and session is missing it
        const needsMgaUpdate = !session.agent_mga_team && mgaName;
        const needsRgaUpdate = !session.agent_rga_team && rgaName;
        
        if (!needsMgaUpdate && !needsRgaUpdate) {
          skippedCount++;
          continue;
        }
        
        // Prepare update
        const updateData = {};
        if (needsMgaUpdate) {
          updateData.agent_mga_team = mgaName;
        }
        if (needsRgaUpdate) {
          updateData.agent_rga_team = rgaName;
        }
        
        // Update session
        try {
          const { error: updateError } = await supabase
            .from('verification_sessions')
            .update(updateData)
            .eq('id', session.id);
          
          if (updateError) {
            errorCount++;
            console.error(`❌ Error updating session ${session.id}:`, updateError);
          } else {
            updatedCount++;
            if (updatedCount <= 20) {
              console.log(`✅ Session ${session.id}: ${hierarchyMatch.email || 'Unknown'}`);
              if (needsMgaUpdate) {
                console.log(`   MGA: null → ${mgaName}`);
              }
              if (needsRgaUpdate) {
                console.log(`   RGA: null → ${rgaName}`);
              }
            }
          }
        } catch (err) {
          errorCount++;
          console.error(`❌ Error updating session ${session.id}:`, err);
        }
      }
      
      // Progress update
      const processed = Math.min(i + BATCH_SIZE, sessions.length);
      console.log(`📊 Progress: ${processed}/${sessions.length} sessions processed`);
    }
    
    // 3. Summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 BACKFILL COMPLETE');
    console.log('═'.repeat(80));
    console.log(`\n✅ Updated: ${updatedCount} sessions`);
    console.log(`⏭️  Skipped (already had data): ${skippedCount} sessions`);
    console.log(`⚠️  Not Found in Hierarchy: ${notFoundCount} sessions`);
    console.log(`❌ Errors: ${errorCount} sessions`);
    console.log(`\n🎯 Total Processed: ${sessions.length} sessions`);
    console.log('═'.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

// Run
backfillVerificationHierarchies().then(() => {
  console.log('✅ Backfill complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
