/**
 * Script: Filter CSV to only DNC and Wrong Number dispositions
 * 
 * Filters the disposition-webhooks.csv to only include:
 * - DNC (code 6)
 * - Wrong Number (code 3)
 * 
 * Run with: tsx server/filter-dnc-wrong-number.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = 'disposition-webhooks.csv';
const OUTPUT_FILE = 'disposition-webhooks-dnc-wrongnumber.csv';

function filterCsv() {
  console.log('\n🔍 FILTERING CSV FOR DNC AND WRONG NUMBER\n');
  console.log('='.repeat(80));

  const inputPath = path.join(process.cwd(), INPUT_FILE);
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📖 Reading: ${INPUT_FILE}`);
  const csvContent = fs.readFileSync(inputPath, 'utf8');
  const lines = csvContent.split('\n');

  if (lines.length === 0) {
    console.error('❌ CSV file is empty');
    process.exit(1);
  }

  // Get header
  const header = lines[0];
  const codeIndex = header.split(',').indexOf('code');
  const dispositionIndex = header.split(',').indexOf('disposition');

  if (codeIndex === -1 || dispositionIndex === -1) {
    console.error('❌ CSV header missing "code" or "disposition" column');
    process.exit(1);
  }

  console.log(`📊 Total rows in input: ${lines.length - 1} (excluding header)\n`);

  // Filter rows: code 3 (Wrong Number) or code 6 (DNC)
  const filteredLines = [header]; // Start with header
  let filteredCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines

    const columns = line.split(',');
    
    // Handle quoted values (simple approach - might need more robust CSV parsing)
    let codeValue = columns[codeIndex];
    let dispositionValue = columns[dispositionIndex];

    // Remove quotes if present
    codeValue = codeValue.replace(/^"|"$/g, '');
    dispositionValue = dispositionValue.replace(/^"|"$/g, '');

    const code = parseInt(codeValue, 10);
    const disposition = dispositionValue.toLowerCase();

    // Include if code is 3 (Wrong Number) or 6 (DNC)
    if (code === 3 || code === 6 || 
        disposition === 'wrong_number' || 
        disposition === 'dnc' || 
        disposition === 'do_not_call') {
      filteredLines.push(line);
      filteredCount++;
    }
  }

  // Write filtered CSV
  fs.writeFileSync(outputPath, filteredLines.join('\n'), 'utf8');

  console.log('='.repeat(80));
  console.log('\n✅ FILTER COMPLETE\n');
  console.log(`   📥 Input file: ${INPUT_FILE}`);
  console.log(`   📤 Output file: ${OUTPUT_FILE}`);
  console.log(`   📊 Total rows filtered: ${filteredCount}`);
  console.log(`   💾 Output file size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB\n`);
}

filterCsv();

