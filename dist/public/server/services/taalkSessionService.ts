/**
 * TaalkAI Session-Based Authentication Service
 * This service uses a browser-like approach to establish a session with the TaalkAI system
 */
import fetch from 'node-fetch';
import * as https from 'https';
import { FormData } from 'formdata-node';

// Constants for the service
const TAALK_WEB_URL = 'https://lets.taalk.ai';
const TAALK_API_URL = 'https://api.taalk.ai';
const TAALK_LOGIN_ENDPOINT = '/login';

// Session state
let sessionCookies: string[] = [];
let sessionActive = false;
let lastLoginAttempt: Date | null = null;

// Create an agent that ignores SSL issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Perform a direct login to the Taalk web interface
 * This mimics a browser session more directly than other approaches
 */
export async function loginToTaalkWeb(): Promise<boolean> {
  // Don't login again if we have a recent session (within 10 minutes)
  const now = new Date();
  if (sessionActive && lastLoginAttempt && (now.getTime() - lastLoginAttempt.getTime() < 10 * 60 * 1000)) {
    console.log('TaalkSessionService: Using existing session');
    return true;
  }
  
  console.log('TaalkSessionService: Starting new login flow');
  lastLoginAttempt = now;
  
  try {
    // Step 1: Get the login page to capture initial cookies
    console.log('TaalkSessionService: Getting login page...');
    const loginPageResponse = await fetch(`${TAALK_WEB_URL}${TAALK_LOGIN_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      agent: httpsAgent,
      redirect: 'manual'
    });
    
    console.log(`TaalkSessionService: Login page status: ${loginPageResponse.status}`);
    
    // Capture cookies if any
    const cookies = loginPageResponse.headers.raw()['set-cookie'] || [];
    if (cookies.length > 0) {
      sessionCookies = cookies;
      console.log(`TaalkSessionService: Captured ${cookies.length} initial cookies`);
    }
    
    // Step 2: Submit the login form
    const credentials = {
      username: 'michaelmandella@aoglobelife.com',
      password: 'Aoletsgrow24!'
    };
    
    console.log('TaalkSessionService: Submitting login form...');
    
    // Create form data
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    // Convert FormData to URLSearchParams for node-fetch
    const params = new URLSearchParams();
    params.append('username', credentials.username);
    params.append('password', credentials.password);
    
    // Submit the form
    const loginResponse = await fetch(`${TAALK_WEB_URL}${TAALK_LOGIN_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': TAALK_WEB_URL,
        'Referer': `${TAALK_WEB_URL}${TAALK_LOGIN_ENDPOINT}`,
        'Cookie': sessionCookies.join('; ')
      },
      body: params.toString(),
      agent: httpsAgent,
      redirect: 'manual'
    });
    
    console.log(`TaalkSessionService: Login response status: ${loginResponse.status}`);
    
    // Extract cookies from the response
    const loginCookies = loginResponse.headers.raw()['set-cookie'] || [];
    if (loginCookies.length > 0) {
      sessionCookies = [...sessionCookies, ...loginCookies];
      console.log(`TaalkSessionService: Captured ${loginCookies.length} additional cookies`);
    }
    
    // Check if login was successful (typically a 302 redirect)
    if (loginResponse.status === 302 || loginResponse.status === 200) {
      console.log('TaalkSessionService: Login appears successful');
      sessionActive = true;
      return true;
    } else {
      console.log('TaalkSessionService: Login failed');
      sessionActive = false;
      return false;
    }
  } catch (error) {
    console.error('TaalkSessionService: Error during login:', error);
    sessionActive = false;
    return false;
  }
}

/**
 * Get a recording using the established session
 */
export async function getRecordingWithSession(recordingId: string, dbName: string = 'michaelmandella'): Promise<Response> {
  // Ensure we have an active session
  if (!sessionActive) {
    const loginSuccess = await loginToTaalkWeb();
    if (!loginSuccess) {
      throw new Error('Failed to establish a session with TaalkAI');
    }
  }
  
  // Construct the URL for the recording
  const recordingUrl = `${TAALK_API_URL}/api/calls/${recordingId}/recording?db=${dbName}`;
  
  console.log(`TaalkSessionService: Requesting recording from ${recordingUrl}`);
  console.log(`TaalkSessionService: Using ${sessionCookies.length} session cookies`);
  
  // Make the request with the session cookies
  try {
    const response = await fetch(recordingUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Origin': TAALK_WEB_URL,
        'Referer': TAALK_WEB_URL,
        'Cookie': sessionCookies.join('; ')
      },
      agent: httpsAgent
    });
    
    console.log(`TaalkSessionService: Recording response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response');
      console.error(`TaalkSessionService: Error retrieving recording: ${errorText.substring(0, 200)}`);
    }
    
    return response;
  } catch (error) {
    console.error('TaalkSessionService: Error getting recording:', error);
    throw error;
  }
}