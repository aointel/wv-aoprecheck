const fs = require('fs');

const csvPath = 'C:\\Users\\mmand\\OneDrive\\Desktop\\AOI\\Producer List 10.24.25.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim());

console.log(`Total lines: ${lines.length}`);
console.log('\nFirst line (header):');
console.log(lines[0]);

console.log('\n\nParsing first 3 data rows...\n');

const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
console.log('Headers:', header);

for (let i = 1; i <= 3; i++) {
  const line = lines[i];
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  console.log(`\nRow ${i}:`);
  console.log(`  Raw line: ${line.substring(0, 100)}...`);
  console.log(`  Values count: ${values.length}`);
  console.log(`  Associate ID value: "${values[0]}"`);
  console.log(`  Agent name: "${values[9]}"`);
  console.log(`  MGA: "${values[1]}"`);
  console.log(`  Phone: "${values[5]}"`);
}

