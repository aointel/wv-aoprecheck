import { Request, Response } from 'express';
import { db } from './db';
import { appointments } from '@shared/schema';
import { and, gte, lte, eq, ne } from 'drizzle-orm';

export async function checkAppointmentConflicts(req: Request, res: Response) {
  try {
    const { agentEmail, startTime, endTime, excludeAppointmentId } = req.body;

    if (!agentEmail || !startTime || !endTime) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentEmail, startTime, endTime' 
      });
    }

    // Build the where conditions
    let whereConditions = [
      eq(appointments.agentEmail, agentEmail),
      // Check for time overlaps: appointment starts before our end time AND appointment ends after our start time
      and(
        lte(appointments.startTime, new Date(endTime)),
        gte(appointments.endTime, new Date(startTime))
      ),
      // Only check non-cancelled appointments
      ne(appointments.status, 'cancelled')
    ];

    // Exclude a specific appointment if provided (for updates)
    if (excludeAppointmentId) {
      whereConditions.push(ne(appointments.id, excludeAppointmentId));
    }

    const conflictingAppointments = await db
      .select()
      .from(appointments)
      .where(and(...whereConditions))
      .limit(10); // Limit to prevent large responses

    const hasConflicts = conflictingAppointments.length > 0;

    res.json({
      hasConflicts,
      conflicts: conflictingAppointments.map(apt => ({
        id: apt.id,
        title: apt.title,
        startTime: apt.startTime,
        endTime: apt.endTime,
        leadName: apt.leadName,
        appointmentType: apt.appointmentType,
        status: apt.status
      }))
    });

  } catch (error) {
    console.error('Error checking appointment conflicts:', error);
    res.status(500).json({ 
      error: 'Failed to check appointment conflicts',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function generateAvailableTimeSlots(req: Request, res: Response) {
  try {
    const { agentEmail, date, duration = 60 } = req.query;

    if (!agentEmail || !date) {
      return res.status(400).json({ 
        error: 'Missing required parameters: agentEmail, date' 
      });
    }

    // Parse the date
    const selectedDate = new Date(date as string);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(9, 0, 0, 0); // Start at 9 AM

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(17, 0, 0, 0); // End at 5 PM

    // Get existing appointments for the day
    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.agentEmail, agentEmail as string),
          gte(appointments.startTime, startOfDay),
          lte(appointments.startTime, endOfDay),
          ne(appointments.status, 'cancelled')
        )
      );

    // Generate time slots (every 30 minutes from 9 AM to 5 PM)
    const timeSlots = [];
    const slotDuration = parseInt(duration as string);
    
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(selectedDate);
        slotStart.setHours(hour, minute, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

        // Check if slot extends beyond business hours
        if (slotEnd.getHours() >= 17) {
          continue;
        }

        // Check for conflicts with existing appointments
        const hasConflict = existingAppointments.some(apt => {
          const aptStart = new Date(apt.startTime);
          const aptEnd = new Date(apt.endTime);
          
          // Check for overlap
          return (slotStart < aptEnd && slotEnd > aptStart);
        });

        timeSlots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          available: !hasConflict,
          conflictWith: hasConflict ? 
            existingAppointments.find(apt => {
              const aptStart = new Date(apt.startTime);
              const aptEnd = new Date(apt.endTime);
              return (slotStart < aptEnd && slotEnd > aptStart);
            })?.title : undefined
        });
      }
    }

    res.json({ timeSlots });

  } catch (error) {
    console.error('Error generating time slots:', error);
    res.status(500).json({ 
      error: 'Failed to generate time slots',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}