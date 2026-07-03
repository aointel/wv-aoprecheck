// FTC Compliance for calling time restrictions based on lead location
export interface FTCTimeZoneRestrictions {
  state: string;
  timeZone: string;
  earliestCallTime: string; // Format: "08:00"
  latestCallTime: string;   // Format: "21:00"
  isDualTimeZone?: boolean; // States that span multiple time zones
}

// FTC requires calls between 8 AM and 9 PM in the lead's local time zone
const FTC_TIME_RESTRICTIONS: FTCTimeZoneRestrictions[] = [
  // Eastern Time
  { state: 'FL', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00', isDualTimeZone: true }, // West Florida is Central Time
  { state: 'GA', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'SC', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NC', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'VA', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MD', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'DE', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NJ', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NY', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'CT', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'RI', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MA', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'VT', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NH', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'ME', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'PA', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'OH', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'WV', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'KY', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'TN', timeZone: 'America/New_York', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MI', timeZone: 'America/Detroit', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'IN', timeZone: 'America/Indiana/Indianapolis', earliestCallTime: '08:00', latestCallTime: '21:00' },

  // Central Time
  { state: 'AL', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'AR', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'IL', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'IA', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'KS', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'LA', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MN', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MS', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'MO', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NE', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'ND', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'OK', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'SD', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'TX', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00', isDualTimeZone: true }, // West Texas is Mountain Time
  { state: 'WI', timeZone: 'America/Chicago', earliestCallTime: '08:00', latestCallTime: '21:00' },

  // Mountain Time
  { state: 'AZ', timeZone: 'America/Phoenix', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'CO', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'ID', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00', isDualTimeZone: true }, // Northern Idaho is Pacific Time
  { state: 'MT', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NV', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'NM', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'UT', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'WY', timeZone: 'America/Denver', earliestCallTime: '08:00', latestCallTime: '21:00' },

  // Pacific Time
  { state: 'CA', timeZone: 'America/Los_Angeles', earliestCallTime: '08:00', latestCallTime: '21:00' },
  { state: 'OR', timeZone: 'America/Los_Angeles', earliestCallTime: '08:00', latestCallTime: '21:00', isDualTimeZone: true }, // Eastern Oregon is Mountain Time
  { state: 'WA', timeZone: 'America/Los_Angeles', earliestCallTime: '08:00', latestCallTime: '21:00' },

  // Alaska Time
  { state: 'AK', timeZone: 'America/Anchorage', earliestCallTime: '08:00', latestCallTime: '21:00' },

  // Hawaii Time
  { state: 'HI', timeZone: 'Pacific/Honolulu', earliestCallTime: '08:00', latestCallTime: '21:00' },
];

export function isCallPermissible(leadState: string, developmentOverride: boolean = false): boolean {
  // Development override for testing - bypass time restrictions
  if (developmentOverride && process.env.NODE_ENV === 'development') {
    console.log(`🚀 DEV OVERRIDE: Allowing call for ${leadState} (development mode)`);
    return true;
  }

  if (!leadState) {
    console.warn('⚠️ No state provided for FTC compliance check');
    return false;
  }

  const stateUpper = leadState.toUpperCase();
  const restriction = FTC_TIME_RESTRICTIONS.find(r => r.state === stateUpper);
  
  if (!restriction) {
    console.warn(`⚠️ No FTC time zone mapping found for state: ${stateUpper}`);
    return false;
  }

  try {
    const now = new Date();
    
    // Get the time in the lead's timezone correctly
    // Use '2-digit' to ensure consistent 0-23 hour format (not 1-12)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restriction.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const [earliestHour, earliestMinute] = restriction.earliestCallTime.split(':').map(Number);
    const [latestHour, latestMinute] = restriction.latestCallTime.split(':').map(Number);
    
    const earliestTimeInMinutes = earliestHour * 60 + earliestMinute;
    const latestTimeInMinutes = latestHour * 60 + latestMinute;
    
    let isPermissible = currentTimeInMinutes >= earliestTimeInMinutes && currentTimeInMinutes <= latestTimeInMinutes;
    
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    
    // SAFETY CHECK: For dual timezone states, err on the side of caution
    if (restriction.isDualTimeZone) {
      // Add 1 hour buffer to be extra safe (call 1 hour later than earliest, 1 hour earlier than latest)
      const safetyBuffer = 60; // 1 hour in minutes
      const safeEarliestTime = earliestTimeInMinutes + safetyBuffer;
      const safeLatestTime = latestTimeInMinutes - safetyBuffer;
      
      isPermissible = currentTimeInMinutes >= safeEarliestTime && currentTimeInMinutes <= safeLatestTime;
      
      if (!isPermissible) {
        console.log(`🚫 FTC DUAL-TZ SAFETY: Call not permissible for ${stateUpper} at ${currentTimeStr} (${restriction.timeZone}). Safe window: ${Math.floor(safeEarliestTime/60)}:${String(safeEarliestTime%60).padStart(2,'0')}-${Math.floor(safeLatestTime/60)}:${String(safeLatestTime%60).padStart(2,'0')}`);
      } else {
        console.log(`✅ FTC DUAL-TZ SAFETY: Call permissible for ${stateUpper} at ${currentTimeStr} (${restriction.timeZone}) within safe window`);
      }
    } else {
      if (!isPermissible) {
        console.log(`🚫 FTC: Call not permissible for ${stateUpper} at ${currentTimeStr} (${restriction.timeZone}). Allowed: ${restriction.earliestCallTime}-${restriction.latestCallTime}`);
      } else {
        console.log(`✅ FTC: Call permissible for ${stateUpper} at ${currentTimeStr} (${restriction.timeZone})`);
      }
    }
    
    return isPermissible;
  } catch (error) {
    console.error('❌ Error checking FTC compliance:', error);
    return false; // Fail safe - don't allow calls if we can't validate
  }
}

export function getNextCallableTime(leadState: string): string | null {
  if (!leadState) return null;
  
  const stateUpper = leadState.toUpperCase();
  const restriction = FTC_TIME_RESTRICTIONS.find(r => r.state === stateUpper);
  
  if (!restriction) return null;
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restriction.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    const currentHour = parseInt(getPart('hour'), 10);
    const currentMinute = parseInt(getPart('minute'), 10);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const [latestHour, latestMinute] = restriction.latestCallTime.split(':').map(Number);
    const [earliestHour, earliestMinute] = restriction.earliestCallTime.split(':').map(Number);
    const latestTimeInMinutes = latestHour * 60 + latestMinute;
    const earliestTimeInMinutes = earliestHour * 60 + earliestMinute;

    if (currentTimeInMinutes >= latestTimeInMinutes) {
      return `Tomorrow at ${restriction.earliestCallTime} (${restriction.timeZone})`;
    }
    if (currentTimeInMinutes < earliestTimeInMinutes) {
      return `Today at ${restriction.earliestCallTime} (${restriction.timeZone})`;
    }
    return `Now (until ${restriction.latestCallTime})`;
  } catch (error) {
    console.error('❌ Error calculating next callable time:', error);
    return null;
  }
}