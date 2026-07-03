#!/usr/bin/env node

/**
 * Comprehensive script to find ALL places where leads are assigned
 * Checks for any potential bypasses of the 45-second duration rule
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 COMPREHENSIVE LEAD ASSIGNMENT CHECK\n');
console.log('='.repeat(80));

// Check server/routes.ts for all assignment points
console.log('\n📋 CHECKING server/routes.ts FOR ALL ASSIGNMENT POINTS:');
console.log('-'.repeat(80));

try {
  const routesContent = readFileSync(join(__dirname, 'server', 'routes.ts'), 'utf-8');
  
  // Find all places where assigned_to, assigned_email, or associate_id is set
  const assignmentPatterns = [
    /assigned_to.*=|assigned_email.*=|associate_id.*=|agent_email.*=/g,
    /\.update\([^)]*assigned|\.insert\([^)]*assigned/g,
    /UPDATE.*assigned|INSERT.*assigned/gi
  ];
  
  let assignmentCount = 0;
  
  // Check /api/dial-lead endpoint specifically
  console.log('\n1️⃣  CHECKING /api/dial-lead endpoint:');
  const dialLeadMatch = routesContent.match(/app\.(post|get)\(["']\/api\/dial-lead["'][\s\S]*?(?=app\.|export|$)/i);
  if (dialLeadMatch) {
    const dialLeadCode = dialLeadMatch[0];
    
    // Check if it assigns leads
    if (dialLeadCode.includes('assigned_to') || dialLeadCode.includes('assigned_email') || dialLeadCode.includes('associate_id')) {
      console.log('   ⚠️  WARNING: /api/dial-lead endpoint may be assigning leads!');
      console.log('   🔍 Checking for duration validation...');
      
      if (!dialLeadCode.includes('duration') && !dialLeadCode.includes('45')) {
        console.log('   ❌ CRITICAL: /api/dial-lead assigns leads WITHOUT duration check!');
        console.log('   📍 This is likely the problem - leads assigned at dial start!');
      } else {
        console.log('   ✅ /api/dial-lead has duration check');
      }
    } else {
      console.log('   ✅ /api/dial-lead does not assign leads');
    }
  }
  
  // Check /api/hotleads/assign-to-agent endpoint
  console.log('\n2️⃣  CHECKING /api/hotleads/assign-to-agent endpoint:');
  const assignEndpointMatch = routesContent.match(/app\.post\(["']\/api\/hotleads\/assign-to-agent["'][\s\S]*?(?=app\.|export|$)/);
  if (assignEndpointMatch) {
    const assignCode = assignEndpointMatch[0];
    
    if (assignCode.includes('!duration') && assignCode.includes('duration < 45')) {
      console.log('   ✅ Has proper duration validation (checks !duration || duration < 45)');
    } else {
      console.log('   ❌ WARNING: May not have proper duration validation');
    }
  }
  
  // Find all assignment operations
  console.log('\n3️⃣  SEARCHING FOR ALL LEAD ASSIGNMENT OPERATIONS:');
  
  const lines = routesContent.split('\n');
  let foundAssignments = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for assignment operations
    if (line.includes('assigned_to') || line.includes('assigned_email') || 
        (line.includes('associate_id') && (line.includes('UPDATE') || line.includes('update') || line.includes('.update')))) {
      
      // Skip if it's part of /api/hotleads/assign-to-agent (already checked)
      if (i > 0 && lines.slice(Math.max(0, i - 50), i).some(l => l.includes('assign-to-agent'))) {
        continue;
      }
      
      // Get context (5 lines before and after)
      const contextStart = Math.max(0, i - 5);
      const contextEnd = Math.min(lines.length, i + 5);
      const context = lines.slice(contextStart, contextEnd);
      const contextLineNumbers = Array.from({ length: contextEnd - contextStart }, (_, j) => contextStart + j + 1);
      
      // Check for endpoint definition
      let endpoint = 'Unknown';
      for (let j = Math.max(0, i - 100); j < i; j++) {
        const epMatch = lines[j].match(/app\.(post|get|put|patch|delete)\(["']([^"']+)["']/);
        if (epMatch) {
          endpoint = epMatch[2];
        }
      }
      
      foundAssignments.push({
        line: i + 1,
        endpoint: endpoint,
        code: line.trim(),
        context: context.map((c, idx) => `${contextLineNumbers[idx]}: ${c}`).join('\n')
      });
    }
  }
  
  if (foundAssignments.length > 0) {
    console.log(`   Found ${foundAssignments.length} potential assignment operations:`);
    foundAssignments.forEach((assignment, idx) => {
      console.log(`\n   ${idx + 1}. Line ${assignment.line} in endpoint: ${assignment.endpoint}`);
      console.log(`      Code: ${assignment.code}`);
      if (!assignment.endpoint.includes('assign-to-agent')) {
        console.log(`      ⚠️  WARNING: This is NOT the assign-to-agent endpoint!`);
        console.log(`      🔍 Checking for duration validation...`);
        const contextLower = assignment.context.toLowerCase();
        if (!contextLower.includes('duration') && !contextLower.includes('45')) {
          console.log(`      ❌ CRITICAL: No duration validation found!`);
        } else {
          console.log(`      ✅ Has duration validation`);
        }
      }
    });
  } else {
    console.log('   ✅ No other assignment operations found');
  }
  
} catch (error) {
  console.log(`❌ Error: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY:');
console.log('='.repeat(80));
console.log(`
🔍 CHECKED:
   ✅ /api/dial-lead endpoint
   ✅ /api/hotleads/assign-to-agent endpoint  
   ✅ All assignment operations in routes.ts

⚠️  KEY FINDINGS:
   - If /api/dial-lead assigns leads without duration check, THAT'S THE PROBLEM
   - All assignments should go through /api/hotleads/assign-to-agent with 45s validation
   - Frontend should only call assign-to-agent after 45 seconds

💡 RECOMMENDATIONS:
   1. Verify /api/dial-lead does NOT assign leads
   2. Ensure all lead assignments use /api/hotleads/assign-to-agent
   3. Check frontend logs for any assignments happening before 45s
`);

console.log('\n✅ Check complete!\n');
