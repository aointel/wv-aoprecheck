import express from 'express';
import { pool } from './db';

export const router = express.Router();

// Simple calendar sync that just creates ICS files without database storage
router.post('/sync', async (req, res) => {
  try {
    const { 
      title = 'AO Intelligence Appointment',
      description = 'Meeting scheduled through ConnectNow',
      startTime, 
      endTime, 
      leadName = 'Client',
      leadPhone = '',
      appointmentId = Date.now().toString()
    } = req.body;
    
    console.log('📅 Creating calendar file:', { title, startTime, endTime });
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "Missing startTime or endTime" });
    }
    
    // Generate ICS file content
    const startDate = new Date(startTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(endTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `appointment-${appointmentId}@aointelligence.com`;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AO Intelligence//ConnectNow//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${title}
DESCRIPTION:${description}\\n\\nClient: ${leadName}\\nPhone: ${leadPhone}
LOCATION:ConnectNow Virtual Meeting
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Appointment reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;
    
    console.log('✅ Calendar file generated successfully');
    
    // Set headers for ICS file download
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointmentId}.ics"`);
    res.send(icsContent);
    
  } catch (error: any) {
    console.error('❌ Error creating calendar file:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to create calendar file'
    });
  }
});

export default router;