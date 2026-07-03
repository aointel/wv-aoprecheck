/**
 * Federal DNC Service
 * 
 * Uses RealPhoneValidation API to check phone numbers against Federal Do Not Call registry.
 * Only used for Plus Leads scrubbing.
 * 
 * API Documentation: https://realphonevalidation.com/dnc-lookup-api-documentation/
 * Rate Limit: 10 calls per second
 */

const FEDERAL_DNC_API_URL = 'https://api.realvalidation.com/rpvWebService/DNCLookup.php';
const FEDERAL_DNC_API_TOKEN = process.env.FEDERAL_DNC_API_TOKEN || 'EEC67156-9A70-43F3-B7D8-872AF89914A4';

interface DNCCheckResult {
  isOnDNC: boolean;
  nationalDNC: 'Y' | 'N' | '?';
  stateDNC: 'Y' | 'N' | '?';
  isCell: 'Y' | 'N' | 'V' | '?';
  error?: string;
  responseCode?: string;
}

// Rate limiting: track last call times to respect 10 calls/second limit
let lastCallTimes: number[] = [];
const RATE_LIMIT_CALLS_PER_SECOND = 10;
const RATE_LIMIT_WINDOW_MS = 1000;

/**
 * Clean phone number to 10 digits only (required by API)
 */
function cleanPhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle US country code (remove leading 1 if present)
  let cleaned = digits;
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = cleaned.substring(1);
  }
  
  // Must be exactly 10 digits
  if (cleaned.length !== 10) {
    return null;
  }
  
  return cleaned;
}

/**
 * Wait if needed to respect rate limit (10 calls/second)
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Remove calls older than 1 second
  lastCallTimes = lastCallTimes.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  
  // If we're at the limit, wait until we can make another call
  if (lastCallTimes.length >= RATE_LIMIT_CALLS_PER_SECOND) {
    const oldestCall = Math.min(...lastCallTimes);
    const waitTime = RATE_LIMIT_WINDOW_MS - (now - oldestCall) + 10; // Add 10ms buffer
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Record this call
  lastCallTimes.push(Date.now());
}

/**
 * Check if phone number is on Federal DNC list
 * @param phone Phone number (any format - will be cleaned to 10 digits)
 * @returns DNC check result
 */
export async function checkFederalDNC(phone: string): Promise<DNCCheckResult> {
  try {
    // Clean phone number to 10 digits
    const cleanedPhone = cleanPhoneNumber(phone);
    
    if (!cleanedPhone) {
      return {
        isOnDNC: false,
        nationalDNC: 'N',
        stateDNC: 'N',
        isCell: '?',
        error: 'Invalid phone number format - must be 10 digits'
      };
    }
    
    // Wait for rate limit
    await waitForRateLimit();
    
    // Make API call
    const url = `${FEDERAL_DNC_API_URL}?phone=${cleanedPhone}&token=${FEDERAL_DNC_API_TOKEN}&output=json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Handle HTTP 403 (rate limit exceeded)
      if (response.status === 403) {
        return {
          isOnDNC: false,
          nationalDNC: '?',
          stateDNC: '?',
          isCell: '?',
          error: 'Rate limit exceeded - temporarily throttled',
          responseCode: '403'
        };
      }
      
      return {
        isOnDNC: false,
        nationalDNC: '?',
        stateDNC: '?',
        isCell: '?',
        error: `API request failed: ${response.status} ${response.statusText}`,
        responseCode: String(response.status)
      };
    }
    
    const data = await response.json();
    
    // Check response code
    if (data.RESPONSECODE !== 'OK') {
      return {
        isOnDNC: false,
        nationalDNC: '?',
        stateDNC: '?',
        isCell: '?',
        error: data.RESPONSEMSG || `API error: ${data.RESPONSECODE}`,
        responseCode: data.RESPONSECODE
      };
    }
    
    // Check if on National DNC (Federal DNC)
    const nationalDNC = (data.national_dnc || 'N').toUpperCase();
    const isOnDNC = nationalDNC === 'Y';
    
    return {
      isOnDNC,
      nationalDNC: nationalDNC as 'Y' | 'N' | '?',
      stateDNC: (data.state_dnc || 'N').toUpperCase() as 'Y' | 'N' | '?',
      isCell: (data.iscell || '?').toUpperCase() as 'Y' | 'N' | 'V' | '?',
      responseCode: data.RESPONSECODE
    };
    
  } catch (error) {
    console.error('❌ Federal DNC check error:', error);
    return {
      isOnDNC: false,
      nationalDNC: '?',
      stateDNC: '?',
      isCell: '?',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if service is configured (has API token)
 */
export function isConfigured(): boolean {
  return !!FEDERAL_DNC_API_TOKEN && FEDERAL_DNC_API_TOKEN !== '';
}

/**
 * Federal DNC Service object for easy importing
 */
export const federalDNCService = {
  checkDNC: checkFederalDNC,
  isConfigured: isConfigured
};



