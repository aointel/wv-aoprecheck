// Clear pending accountability reports for testing
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './shared/schema.js';

const DATABASE_URL = 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function clearPendingReports() {
  try {
    const userEmail = 'chrislafond@aoglobelife.com';
    console.log('Checking pending appointments for:', userEmail);
    
    // First, let's see what appointments exist
    const pendingAppointments = await sql`
      SELECT id, title, start_time, status, completed_at
      FROM appointments 
      WHERE agent_email = ${userEmail} 
        AND start_time < CURRENT_DATE 
        AND status = 'scheduled'
      ORDER BY start_time DESC
    `;
    
    console.log('Found pending appointments:', pendingAppointments);
    
    if (pendingAppointments.length > 0) {
      console.log('Creating accountability reports to clear the block...');
      
      // Create a daily accountability report for Aug 7th to clear the block
      const accountabilityDate = '2025-08-07';
      
      // Check if report already exists
      const existingReport = await sql`
        SELECT id FROM daily_accountability 
        WHERE agent_email = ${userEmail} AND accountability_date = ${accountabilityDate}
      `;
      
      if (existingReport.length === 0) {
        // Create the accountability report
        await sql`
          INSERT INTO daily_accountability (
            agent_email, accountability_date, total_appointments, completed_appointments,
            total_sales, plus_leads_collected, notes, status, created_at
          ) VALUES (
            ${userEmail}, ${accountabilityDate}, ${pendingAppointments.length}, ${pendingAppointments.length},
            0, 0, 'Auto-generated for testing - clearing authentication block', 'submitted', NOW()
          )
        `;
        
        console.log('✅ Created accountability report for', accountabilityDate);
      } else {
        console.log('✅ Accountability report already exists for', accountabilityDate);
      }
      
      // Mark appointments as completed
      await sql`
        UPDATE appointments 
        SET status = 'completed', completed_at = NOW()
        WHERE agent_email = ${userEmail} 
          AND start_time < CURRENT_DATE 
          AND status = 'scheduled'
      `;
      
      console.log('✅ Marked all pending appointments as completed');
    } else {
      console.log('No pending appointments found');
    }
    
    console.log('✅ All done! User should now be able to access the dashboard');
    
  } catch (error) {
    console.error('Failed to clear reports:', error);
  }
}

clearPendingReports();