import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file with production data
function parseProductionData() {
  try {
    console.log('📊 Reading Excel file: July_Contest_With_Markets_1754402815852.xlsx');
    
    const workbook = XLSX.readFile('./attached_assets/July_Contest_With_Markets_1754402815852.xlsx');
    const sheetNames = workbook.SheetNames;
    console.log('📋 Available sheets:', sheetNames);
    
    // Read the first sheet
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);
    
    console.log('📈 Production data preview:');
    console.log('Total records:', data.length);
    
    if (data.length > 0) {
      console.log('Sample record:');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Look for production/ALP related fields
      const sampleKeys = Object.keys(data[0]);
      console.log('Available fields:', sampleKeys);
      
      // Find associates with email addresses matching our system
      const associatesWithEmails = data.filter(record => {
        const keys = Object.keys(record);
        return keys.some(key => 
          key.toLowerCase().includes('email') || 
          key.toLowerCase().includes('agent') ||
          key.toLowerCase().includes('name')
        );
      });
      
      console.log('📧 Associates with identifiable data:', associatesWithEmails.length);
      if (associatesWithEmails.length > 0) {
        console.log('Sample associate data:');
        console.log(JSON.stringify(associatesWithEmails[0], null, 2));
      }
      
      // Look for production/ALP fields
      const productionFields = data.map(record => {
        const keys = Object.keys(record);
        return keys.filter(key => 
          key.toLowerCase().includes('alp') ||
          key.toLowerCase().includes('production') ||
          key.toLowerCase().includes('premium') ||
          key.toLowerCase().includes('volume') ||
          key.toLowerCase().includes('sales') ||
          key.toLowerCase().includes('amount') ||
          key.toLowerCase().includes('total')
        );
      }).flat();
      
      const uniqueProductionFields = [...new Set(productionFields)];
      console.log('💰 Potential production fields:', uniqueProductionFields);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    return null;
  }
}

// Run the parser
const productionData = parseProductionData();

if (productionData) {
  // Save parsed data as JSON for easy import
  fs.writeFileSync('./production-data.json', JSON.stringify(productionData, null, 2));
  console.log('✅ Production data saved to production-data.json');
}