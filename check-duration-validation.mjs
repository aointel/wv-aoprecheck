#!/usr/bin/env node

/**
 * Script to verify duration validation logic in the codebase
 * Checks both frontend and backend code to ensure 45-second rule is enforced
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 CHECKING DURATION VALIDATION FOR LEAD ASSIGNMENT\n');
console.log('='.repeat(80));

// Check backend validation
console.log('\n📋 BACKEND VALIDATION (server/routes.ts):');
console.log('-'.repeat(80));
try {
  const routesContent = readFileSync(join(__dirname, 'server', 'routes.ts'), 'utf-8');
  
  // Find the assign-to-agent endpoint
  const assignEndpointMatch = routesContent.match(/app\.post\(["']\/api\/hotleads\/assign-to-agent["'][\s\S]*?(?=app\.|export|$)/);
  
  if (assignEndpointMatch) {
    const endpointCode = assignEndpointMatch[0];
    
    // Check for duration validation
    const durationCheck = endpointCode.match(/duration.*<.*45|!duration|duration\s*<\s*45/g);
    if (durationCheck) {
      console.log('✅ Found duration validation check in backend');
      
      // Extract the validation logic
      const validationBlock = endpointCode.match(/if\s*\([^)]*duration[^)]*\)\s*\{[\s\S]*?\}/);
      if (validationBlock) {
        const validationLines = validationBlock[0].split('\n').slice(0, 10).join('\n');
        console.log('\n   Validation logic:');
        console.log('   ' + validationLines.split('\n').map(l => '   ' + l.trim()).join('\n'));
      }
    } else {
      console.log('❌ WARNING: Could not find duration validation in backend');
    }
    
    // Check for the exact check: if (!duration || duration < 45)
    if (endpointCode.includes('!duration') && endpointCode.includes('duration < 45')) {
      console.log('✅ Backend correctly checks: !duration || duration < 45');
    } else {
      console.log('❌ WARNING: Backend duration check may be incorrect');
    }
    
    // Check return status
    if (endpointCode.includes('status(400)') || endpointCode.includes('status: 400')) {
      console.log('✅ Backend returns 400 status for invalid duration');
    }
  } else {
    console.log('❌ Could not find /api/hotleads/assign-to-agent endpoint');
  }
} catch (error) {
  console.log(`❌ Error reading backend code: ${error.message}`);
}

// Check frontend validation (OutboundDialerInterface)
console.log('\n\n📋 FRONTEND VALIDATION (OutboundDialerInterface.tsx):');
console.log('-'.repeat(80));
try {
  const frontendContent = readFileSync(join(__dirname, 'client', 'src', 'components', 'outbound-dialer', 'OutboundDialerInterface.tsx'), 'utf-8');
  
  // Check for duration check before calling API
  if (frontendContent.includes('newDuration >= 45') && frontendContent.includes('newDuration < 46')) {
    console.log('✅ Frontend checks duration >= 45 before calling API');
    console.log('   Trigger: newDuration >= 45 && newDuration < 46');
  } else {
    console.log('❌ WARNING: Frontend may not be checking duration correctly');
  }
  
  // Check for the API call
  if (frontendContent.includes('/api/hotleads/assign-to-agent')) {
    console.log('✅ Frontend calls /api/hotleads/assign-to-agent endpoint');
  }
  
  // Check for duration in the API call body
  if (frontendContent.includes('duration: newDuration')) {
    console.log('✅ Frontend sends duration in API request body');
  }
} catch (error) {
  console.log(`❌ Error reading frontend code: ${error.message}`);
}

// Check RecruitOutboundDialerInterface
console.log('\n\n📋 FRONTEND VALIDATION (RecruitOutboundDialerInterface.tsx):');
console.log('-'.repeat(80));
try {
  const recruitContent = readFileSync(join(__dirname, 'client', 'src', 'components', 'outbound-dialer', 'RecruitOutboundDialerInterface.tsx'), 'utf-8');
  
  // Check for duration check
  if (recruitContent.includes('newDuration >= 45') && recruitContent.includes('newDuration < 46')) {
    console.log('✅ Recruit dialer checks duration >= 45 before calling API');
  } else {
    console.log('❌ WARNING: Recruit dialer may not be checking duration correctly');
  }
  
  if (recruitContent.includes('/api/hotleads/assign-to-agent')) {
    console.log('✅ Recruit dialer calls /api/hotleads/assign-to-agent endpoint');
  }
} catch (error) {
  console.log(`❌ Error reading recruit dialer code: ${error.message}`);
}

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('📊 VALIDATION SUMMARY:');
console.log('='.repeat(80));
console.log(`
✅ EXPECTED BEHAVIOR:
   - Frontend: Only triggers API call when duration >= 45 seconds (exact second: 45)
   - Backend: Rejects requests with duration < 45 seconds (returns 400)
   - Backend: Rejects requests with null/undefined duration (returns 400)
   - Backend: Accepts requests with duration >= 45 seconds

🔍 VALIDATION POINTS:
   1. Frontend timer triggers at exactly 45 seconds (newDuration >= 45 && newDuration < 46)
   2. Backend checks: if (!duration || duration < 45) { return 400 }
   3. Both checks must pass for lead assignment to succeed

⚠️  POTENTIAL ISSUES:
   - If frontend sends wrong duration value
   - If backend validation is bypassed somehow
   - If multiple API calls are made (timerKey should prevent this)
`);

console.log('\n✅ Validation check complete!\n');
