// Quick script to trigger attribution fix immediately
import { twilioAutoSync } from './server/twilio-auto-sync.js';

console.log('🔧 TRIGGERING ATTRIBUTION FIX IMMEDIATELY...');

async function fixAttributions() {
  try {
    await twilioAutoSync.fixExistingAttributions();
    console.log('✅ Attribution fix completed');
  } catch (error) {
    console.error('❌ Attribution fix failed:', error);
  }
}

fixAttributions();