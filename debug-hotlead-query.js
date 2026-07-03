#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugHotleadQuery() {
  console.log('🔍 DEBUG: Checking hotleads for cnsysop@aoglobelife.com...');
  
  try {
    // First, check all hotleads to see what's available
    const { data: allHotleads, error: allError } = await supabase
      .from('hotleads')
      .select('*')
      .limit(10);
    
    if (allError) {
      console.error('❌ Error fetching all hotleads:', allError);
      return;
    }
    
    console.log(`📊 Total hotleads in database: ${allHotleads.length}`);
    if (allHotleads.length > 0) {
      console.log('📋 Sample hotlead structure:', allHotleads[0]);
    }
    
    // Now check specifically for cnsysop
    const { data: cnsysopHotleads, error: cnsysopError } = await supabase
      .from('hotleads')
      .select('*')
      .eq('cn_email', 'cnsysop@aoglobelife.com');
    
    if (cnsysopError) {
      console.error('❌ Error fetching cnsysop hotleads:', cnsysopError);
      return;
    }
    
    console.log(`🎯 Hotleads assigned to cnsysop@aoglobelife.com: ${cnsysopHotleads.length}`);
    
    if (cnsysopHotleads.length > 0) {
      console.log('📋 cnsysop hotleads:', cnsysopHotleads);
    } else {
      console.log('❌ No hotleads found for cnsysop@aoglobelife.com');
      
      // Check if there are any hotleads with similar emails
      const { data: similarEmails, error: similarError } = await supabase
        .from('hotleads')
        .select('cn_email')
        .not('cn_email', 'is', null)
        .limit(20);
      
      if (!similarError && similarEmails) {
        console.log('📧 Available emails in hotleads table:', 
          [...new Set(similarEmails.map(h => h.cn_email))]);
      }
    }
    
    // Check pending hotleads specifically
    const { data: pendingHotleads, error: pendingError } = await supabase
      .from('hotleads')
      .select('*')
      .eq('cnresolution', 'pending')
      .eq('cn_email', 'cnsysop@aoglobelife.com');
    
    if (!pendingError) {
      console.log(`📋 Pending hotleads for cnsysop: ${pendingHotleads.length}`);
    }
    
  } catch (error) {
    console.error('💥 Error in debug script:', error);
  }
}

debugHotleadQuery();