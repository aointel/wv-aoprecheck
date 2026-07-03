import * as XLSX from 'xlsx';
import * as path from 'path';
import { db } from "./storage";

interface ProducerRecord {
  associate_id?: string;
  first_name?: string;
  last_name?: string;
  mga?: string;
  rga?: string;
  [key: string]: any;
}

export class HierarchyProcessor {
  private hierarchyMap: Map<string, { mga: string | null; rga: string | null }> = new Map();

  /**
   * Load producer hierarchy from Excel file
   */
  async loadProducerHierarchy(excelFilePath: string): Promise<void> {
    console.log('📊 Loading producer hierarchy from Excel file...');
    
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0]; // First sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data: ProducerRecord[] = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`📄 Found ${data.length} producer records`);
      
      // Process each record and build hierarchy map
      for (const record of data) {
        const associateId = this.extractAssociateId(record);
        if (associateId) {
          const mga = this.extractMGA(record);
          const rga = this.extractRGA(record);
          
          this.hierarchyMap.set(associateId, { mga, rga });
          
          if (mga || rga) {
            console.log(`👥 Agent ${associateId}: MGA=${mga || 'None'}, RGA=${rga || 'None'}`);
          }
        }
      }
      
      console.log(`✅ Loaded hierarchy for ${this.hierarchyMap.size} agents`);
      
    } catch (error) {
      console.error('❌ Error loading producer hierarchy:', error);
      throw error;
    }
  }

  /**
   * Get MGA/RGA for an agent ID
   */
  getHierarchy(agentId: string): { mga: string | null; rga: string | null } {
    return this.hierarchyMap.get(agentId) || { mga: null, rga: null };
  }

  /**
   * Extract associate ID from various possible column names
   */
  private extractAssociateId(record: ProducerRecord): string | null {
    // Try common column name variations
    const possibleKeys = [
      'associate_id', 'Associate ID', 'AssociateId', 'ASSOCIATE_ID',
      'id', 'ID', 'Agent ID', 'agent_id', 'AgentId',
      'producer_id', 'Producer ID', 'ProducerId'
    ];
    
    for (const key of possibleKeys) {
      if (record[key]) {
        return record[key].toString().trim();
      }
    }
    
    return null;
  }

  /**
   * Extract MGA from various possible column names
   */
  private extractMGA(record: ProducerRecord): string | null {
    const possibleKeys = [
      'mga', 'MGA', 'Mga',
      'master_general_agent', 'Master General Agent',
      'manager', 'Manager', 'MANAGER',
      'hierarchy_mga', 'mga_name'
    ];
    
    for (const key of possibleKeys) {
      if (record[key] && record[key].toString().trim()) {
        return record[key].toString().trim();
      }
    }
    
    return null;
  }

  /**
   * Extract RGA from various possible column names
   */
  private extractRGA(record: ProducerRecord): string | null {
    const possibleKeys = [
      'rga', 'RGA', 'Rga', 
      'regional_general_agent', 'Regional General Agent',
      'regional_manager', 'Regional Manager',
      'hierarchy_rga', 'rga_name'
    ];
    
    for (const key of possibleKeys) {
      if (record[key] && record[key].toString().trim()) {
        return record[key].toString().trim();
      }
    }
    
    return null;
  }

  /**
   * Create a hierarchy lookup table in database
   */
  async createHierarchyTable(): Promise<void> {
    console.log('🏗️ Creating hierarchy lookup table...');
    
    try {
      // Create table if doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS agent_hierarchy (
          agent_id TEXT PRIMARY KEY,
          mga TEXT,
          rga TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Agent hierarchy table created');
      
    } catch (error) {
      console.error('❌ Error creating hierarchy table:', error);
    }
  }

  /**
   * Insert hierarchy data into database
   */
  async saveHierarchyToDatabase(): Promise<void> {
    console.log('💾 Saving hierarchy data to database...');
    
    try {
      await this.createHierarchyTable();
      
      // Clear existing data
      await db.execute('DELETE FROM agent_hierarchy');
      
      // Insert new data
      for (const [agentId, hierarchy] of this.hierarchyMap) {
        await db.execute(`
          INSERT INTO agent_hierarchy (agent_id, mga, rga) 
          VALUES (?, ?, ?)
        `, [agentId, hierarchy.mga, hierarchy.rga]);
      }
      
      console.log(`✅ Saved ${this.hierarchyMap.size} hierarchy records to database`);
      
    } catch (error) {
      console.error('❌ Error saving hierarchy to database:', error);
    }
  }

  /**
   * Test the hierarchy data
   */
  async testHierarchy(): Promise<void> {
    console.log('🧪 Testing hierarchy lookups...');
    
    // Test with some known agent IDs from the VDP events
    const testAgents = ['67222', '194954', '409', '124235'];
    
    for (const agentId of testAgents) {
      const hierarchy = this.getHierarchy(agentId);
      console.log(`👤 Agent ${agentId}: MGA=${hierarchy.mga || 'None'}, RGA=${hierarchy.rga || 'None'}`);
    }
  }
}

// Export singleton
export const hierarchyProcessor = new HierarchyProcessor();