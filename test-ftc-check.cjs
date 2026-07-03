// Test the FTC timezone logic

const stateTimezones = {
  // Eastern Time
  'FL': 'America/New_York', 'GA': 'America/New_York', 'SC': 'America/New_York',
  'NC': 'America/New_York', 'VA': 'America/New_York', 'WV': 'America/New_York',
  'MD': 'America/New_York', 'DE': 'America/New_York', 'PA': 'America/New_York',
  'NJ': 'America/New_York', 'NY': 'America/New_York', 'CT': 'America/New_York',
  'RI': 'America/New_York', 'MA': 'America/New_York', 'VT': 'America/New_York',
  'NH': 'America/New_York', 'ME': 'America/New_York', 'OH': 'America/New_York',
  'MI': 'America/New_York', 'IN': 'America/New_York', 'KY': 'America/New_York',
  
  // Central Time
  'TX': 'America/Chicago', 'OK': 'America/Chicago', 'KS': 'America/Chicago',
  'NE': 'America/Chicago', 'SD': 'America/Chicago', 'ND': 'America/Chicago',
  'MN': 'America/Chicago', 'IA': 'America/Chicago', 'MO': 'America/Chicago',
  'AR': 'America/Chicago', 'LA': 'America/Chicago', 'MS': 'America/Chicago',
  'AL': 'America/Chicago', 'TN': 'America/Chicago', 'WI': 'America/Chicago',
  'IL': 'America/Chicago',
  
  // Mountain Time
  'MT': 'America/Denver', 'WY': 'America/Denver', 'CO': 'America/Denver',
  'NM': 'America/Denver', 'UT': 'America/Denver', 'ID': 'America/Denver',
  
  // Pacific Time
  'CA': 'America/Los_Angeles', 'WA': 'America/Los_Angeles', 'OR': 'America/Los_Angeles',
  'NV': 'America/Los_Angeles',
  
  // Alaska
  'AK': 'America/Anchorage',
  
  // Hawaii
  'HI': 'America/Honolulu',
  
  // Arizona (no DST)
  'AZ': 'America/Phoenix'
};

function checkFTC(leadState) {
  const timezone = stateTimezones[leadState];
  if (!timezone) return { allowed: false, reason: 'Unknown state' };
  
  const leadTime = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const currentHour = leadTime.getHours();
  const currentMinute = leadTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // FTC allows 8 AM (480 minutes) to 9 PM (1260 minutes)
  const isPermissible = currentTimeInMinutes >= 480 && currentTimeInMinutes <= 1260;
  
  return {
    allowed: isPermissible,
    time: leadTime.toLocaleTimeString(),
    timezone,
    minutes: currentTimeInMinutes,
    window: '8:00 AM - 9:00 PM'
  };
}

// Test states
const testStates = ['TX', 'CA', 'NY', 'FL', 'HI'];

console.log('🕐 FTC COMPLIANCE CHECK\n');
testStates.forEach(state => {
  const result = checkFTC(state);
  const status = result.allowed ? '✅ ALLOWED' : '🚫 BLOCKED';
  console.log(`${status} ${state}: ${result.time} ${result.timezone}`);
});

