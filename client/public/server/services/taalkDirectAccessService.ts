/**
 * Direct API access service for TaalkAI
 * This service provides direct access to TaalkAI API without relying on browser-based authentication
 */

// The base URLs for TaalkAI
const TAALK_WEB_BASE = 'https://lets.taalk.ai';
const TAALK_API_BASE = 'https://api.taalk.ai';
const TAALK_LOGIN_URL = 'https://lets.taalk.ai/login';

// Headers for API requests
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
  'Origin': 'https://lets.taalk.ai',
  'Referer': 'https://lets.taalk.ai/'
};

/**
 * Get authentication headers for direct API access
 * @returns Headers for API requests
 */
export function getDirectAccessHeaders(): Record<string, string> {
  // Credentials for direct API access
  const username = process.env.TAALK_API_USERNAME || 'michaelmandella@aoglobelife.com';
  const password = process.env.TAALK_API_PASSWORD || 'Aoletsgrow24!';
  
  // Create basic auth header
  const authString = `${username}:${password}`;
  const base64Auth = Buffer.from(authString).toString('base64');
  
  return {
    ...DEFAULT_HEADERS,
    'Authorization': `Basic ${base64Auth}`
  };
}

/**
 * Access TaalkAI recording directly using API credentials
 * @param recordingId The ID of the recording to access
 * @param dbName The database name parameter
 * @returns The API response
 */
export async function accessTaalkRecording(recordingId: string, dbName: string): Promise<Response> {
  // Construct the URL with the recording ID and database parameter
  const url = `${TAALK_API_BASE}/api/calls/${recordingId}/recording?db=${dbName}`;
  
  console.log(`Accessing TaalkAI recording directly at: ${url}`);
  
  // Make the request with authentication headers
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getDirectAccessHeaders()
    });
    
    console.log(`TaalkAI direct API response status: ${response.status}`);
    
    if (!response.ok) {
      // If the response is not OK, log additional information
      console.error(`TaalkAI direct API error: ${response.status} ${response.statusText}`);
      
      // Try to read response body for more information
      try {
        const errorBody = await response.text();
        console.error(`Error response body: ${errorBody.substring(0, 200)}...`);
      } catch (e) {
        console.error('Could not read error response body');
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error accessing TaalkAI recording:', error);
    throw error;
  }
}

/**
 * Alternative method using direct URL access with query parameters for authentication
 * This is a fallback method if Basic Auth doesn't work
 */
export async function accessTaalkRecordingWithQueryParams(recordingId: string, dbName: string): Promise<Response> {
  // Get credentials
  const username = process.env.TAALK_API_USERNAME || 'michaelmandella@aoglobelife.com';
  const password = process.env.TAALK_API_PASSWORD || 'Aoletsgrow24!';
  
  // Construct URL with authentication parameters
  const url = `${TAALK_API_BASE}/api/calls/${recordingId}/recording?db=${dbName}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  
  console.log(`Accessing TaalkAI recording with query params at URL: ${url.replace(/password=.*?(&|$)/, 'password=REDACTED$1')}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS
    });
    
    console.log(`TaalkAI query param API response status: ${response.status}`);
    
    return response;
  } catch (error) {
    console.error('Error accessing TaalkAI recording with query params:', error);
    throw error;
  }
}