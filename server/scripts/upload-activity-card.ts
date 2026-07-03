/**
 * Upload activity card to Supabase
 */

import { supabaseAdmin } from '../supabase';
import * as fs from 'fs';
import * as path from 'path';

async function uploadActivityCard() {
  try {
    // Find the most recent activity card
    const serverTempPath = path.join(process.cwd(), 'temp', 'activity-card-1772058934733.png');
    const rootTempPath = path.join(process.cwd(), '..', 'temp', 'activity-card-1772058934733.png');
    
    let filePath: string | null = null;
    if (fs.existsSync(serverTempPath)) {
      filePath = serverTempPath;
    } else if (fs.existsSync(rootTempPath)) {
      filePath = rootTempPath;
    } else {
      // Find the most recent one
      const serverTempDir = path.join(process.cwd(), 'temp');
      const rootTempDir = path.join(process.cwd(), '..', 'temp');
      
      let files: string[] = [];
      if (fs.existsSync(serverTempDir)) {
        files = fs.readdirSync(serverTempDir)
          .filter(f => f.startsWith('activity-card-') && f.endsWith('.png'))
          .map(f => path.join(serverTempDir, f));
      }
      if (fs.existsSync(rootTempDir)) {
        const rootFiles = fs.readdirSync(rootTempDir)
          .filter(f => f.startsWith('activity-card-') && f.endsWith('.png'))
          .map(f => path.join(rootTempDir, f));
        files = files.concat(rootFiles);
      }
      
      if (files.length === 0) {
        throw new Error('No activity card files found');
      }
      
      // Get most recent
      filePath = files
        .map(f => ({ path: f, time: fs.statSync(f).mtime.getTime() }))
        .sort((a, b) => b.time - a.time)[0].path;
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Activity card file not found: ${filePath}`);
    }
    
    console.log(`📤 Uploading activity card: ${filePath}`);
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = `activity-card-${Date.now()}.png`;
    
    console.log('📤 Uploading to Supabase hourly-reports bucket...');
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('hourly-reports')
      .upload(fileName, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Failed to upload to Supabase:', uploadError);
      // Try installers bucket as fallback
      console.log('⚠️ Trying installers bucket as fallback...');
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin.storage
        .from('installers')
        .upload(`hourly-reports/${fileName}`, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (fallbackError) {
        console.error('❌ Failed to upload to fallback bucket:', fallbackError);
        throw fallbackError;
      } else {
        console.log('✅ Uploaded to installers bucket fallback');
        const { data: urlData } = supabaseAdmin.storage
          .from('installers')
          .getPublicUrl(`hourly-reports/${fileName}`);
        
        if (urlData?.publicUrl) {
          console.log('🔗 Public URL:', urlData.publicUrl);
        }
      }
    } else {
      console.log('✅ Uploaded to Supabase hourly-reports bucket:', fileName);
      
      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('hourly-reports')
        .getPublicUrl(fileName);
      
      if (publicUrlData?.publicUrl) {
        console.log('🔗 Public URL:', publicUrlData.publicUrl);
      }
    }
    
    console.log('✅ Upload complete!');
  } catch (error: any) {
    console.error('❌ Error uploading activity card:', error.message);
    process.exit(1);
  }
}

uploadActivityCard();
