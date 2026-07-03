import { hierarchyProcessor } from './hierarchy-processor';
import * as path from 'path';

async function loadHierarchyData() {
  try {
    console.log('🚀 Loading producer hierarchy from Excel file...');
    
    // Path to the uploaded Excel file
    const excelFilePath = path.join(process.cwd(), 'attached_assets', 'Producer List 9.5.25_1757177701952.xlsx');
    
    // Load hierarchy from Excel
    await hierarchyProcessor.loadProducerHierarchy(excelFilePath);
    
    // Save to database
    await hierarchyProcessor.saveHierarchyToDatabase();
    
    // Test with some agent IDs
    await hierarchyProcessor.testHierarchy();
    
    console.log('✅ Hierarchy loading completed successfully!');
    
  } catch (error) {
    console.error('❌ Error loading hierarchy data:', error);
  }
}

// Run the loader
loadHierarchyData();