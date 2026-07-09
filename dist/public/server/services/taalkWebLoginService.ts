/**
 * Service for logging in to the TaalkAI web interface
 * This service handles the browser-like login flow to get a valid session
 */
import fetch from 'node-fetch';
import * as https from 'https';
import * as cheerio from 'cheerio';

// Base URLs for TaalkAI
const TAALK_WEB_BASE = 'https://lets.taalk.ai';
const TAALK_LOGIN_URL = 'https://lets.taalk.ai/login';
const TAALK_API_BASE = 'https://api.taalk.ai';

// Session storage
interface TaalkSession {
  cookies: string[];
  csrfToken: string | null;
  lastLogin: Date | null;
}

// Initialize the session
let session: TaalkSession = {
  cookies: [],
  csrfToken: null,
  lastLogin: null
};

// Create an HTTPS agent that ignores SSL certificate issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Get the user-agent string for browser-like requests
 */
function getUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
}

/**
 * Extract cookies from response headers
 */
function extractCookies(response: any): string[] {
  const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
  return setCookieHeaders;
}

/**
 * Extract CSRF token from HTML
 */
function extractCsrfToken(html: string): string | null {
  try {
    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);
    
    // Look for the CSRF token input
    const csrfToken = $('input[name="csrf_token"]').val();
    
    return csrfToken as string || null;
  } catch (error) {
    console.error('Error extracting CSRF token:', error);
    return null;
  }
}

/**
 * Get the login page and extract initial cookies and CSRF token
 */
async function getLoginPage(): Promise<{ cookies: string[]; csrfToken: string | null }> {
  try {
    console.log(`Fetching login page from ${TAALK_LOGIN_URL}...`);
    
    const response = await fetch(TAALK_LOGIN_URL, {
      method: 'GET',
      headers: {
        'User-Agent': getUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      agent: httpsAgent
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch login page: ${response.status} ${response.statusText}`);
      return { cookies: [], csrfToken: null };
    }
    
    // Extract cookies
    const cookies = extractCookies(response);
    
    // Get the HTML content
    const html = await response.text();
    
    // Extract CSRF token
    const csrfToken = extractCsrfToken(html);
    
    console.log(`Login page fetched successfully. Found CSRF token: ${csrfToken ? 'Yes' : 'No'}`);
    
    return { cookies, csrfToken };
  } catch (error) {
    console.error('Error fetching login page:', error);
    return { cookies: [], csrfToken: null };
  }
}

/**
 * Submit the login form with credentials
 */
async function submitLoginForm(cookies: string[], csrfToken: string | null): Promise<string[]> {
  try {
    // Get credentials
    const username = process.env.TAALK_API_USERNAME || 'michaelmandella@aoglobelife.com';
    const password = process.env.TAALK_API_PASSWORD || 'Aoletsgrow24!';
    
    console.log(`Submitting login form with username: ${username}...`);
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    // Add CSRF token if available
    if (csrfToken) {
      formData.append('csrf_token', csrfToken);
    }
    
    // Submit login form
    const response = await fetch(TAALK_LOGIN_URL, {
      method: 'POST',
      headers: {
        'User-Agent': getUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': TAALK_WEB_BASE,
        'Referer': TAALK_LOGIN_URL,
        'Cookie': cookies.join('; ')
      },
      body: formData.toString(),
      redirect: 'manual', // Don't follow redirects automatically
      agent: httpsAgent
    });
    
    console.log(`Login form submitted. Response status: ${response.status}`);
    
    // Extract cookies from the response
    const newCookies = extractCookies(response);
    
    // Combine old and new cookies
    const allCookies = [...cookies, ...newCookies].filter(Boolean);
    
    if (response.status === 302) {
      console.log('Login successful. Received redirect response.');
      
      // Get the redirect location
      const location = response.headers.get('location');
      
      if (location) {
        console.log(`Following redirect to: ${location}`);
        
        // Follow the redirect manually to get any additional cookies
        const redirectUrl = new URL(location, TAALK_WEB_BASE).toString();
        
        const redirectResponse = await fetch(redirectUrl, {
          headers: {
            'User-Agent': getUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cookie': allCookies.join('; ')
          },
          agent: httpsAgent
        });
        
        console.log(`Redirect followed. Response status: ${redirectResponse.status}`);
        
        // Extract cookies from the redirect response
        const redirectCookies = extractCookies(redirectResponse);
        
        // Combine all cookies
        return [...allCookies, ...redirectCookies].filter(Boolean);
      }
    }
    
    return allCookies;
  } catch (error) {
    console.error('Error submitting login form:', error);
    return cookies;
  }
}

/**
 * Log in to TaalkAI web interface and get a valid session
 * @returns Whether login was successful
 */
export async function loginToTaalkWeb(): Promise<boolean> {
  // Don't login again if we have a recent session (within 30 minutes)
  if (
    session.cookies.length > 0 && 
    session.lastLogin && 
    (new Date().getTime() - session.lastLogin.getTime() < 30 * 60 * 1000)
  ) {
    console.log('Using existing TaalkAI web session.');
    return true;
  }
  
  console.log('Starting new TaalkAI web login flow...');
  console.log(`Using credentials: ${process.env.TAALK_API_USERNAME} / ${process.env.TAALK_API_PASSWORD ? '********' : 'missing'}`);
  
  try {
    // Step 1: Get login page and extract initial cookies and CSRF token
    const { cookies, csrfToken } = await getLoginPage();
    
    console.log(`Initial cookies received: ${cookies.length}`);
    if (csrfToken) {
      console.log(`CSRF token found: ${csrfToken.substring(0, 10)}...`);
    } else {
      console.log(`No CSRF token found in login page`);
    }
    
    if (!cookies.length) {
      console.error('Failed to get initial cookies from login page.');
      return false;
    }
    
    // Step 2: Submit login form
    const sessionCookies = await submitLoginForm(cookies, csrfToken);
    
    if (sessionCookies.length > cookies.length) {
      // Update session
      session = {
        cookies: sessionCookies,
        csrfToken,
        lastLogin: new Date()
      };
      
      console.log('Successfully logged in to TaalkAI web interface.');
      return true;
    } else {
      console.error('Failed to log in to TaalkAI web interface.');
      return false;
    }
  } catch (error) {
    console.error('Error logging in to TaalkAI web interface:', error);
    return false;
  }
}

/**
 * Get session cookies for use in API requests
 */
export function getSessionCookies(): string {
  return session.cookies.join('; ');
}

/**
 * Get headers for authenticated API requests
 */
export function getAuthenticatedHeaders(): Record<string, string> {
  return {
    'User-Agent': getUserAgent(),
    'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Origin': TAALK_WEB_BASE,
    'Referer': TAALK_WEB_BASE,
    'Cookie': getSessionCookies()
  };
}

/**
 * Access TaalkAI recording with web session authentication
 */
export async function accessRecordingWithWebSession(recordingId: string, dbName: string): Promise<Response> {
  try {
    // Ensure we're logged in
    const isLoggedIn = await loginToTaalkWeb();
    
    if (!isLoggedIn) {
      throw new Error('Failed to log in to TaalkAI web interface.');
    }
    
    // Construct the recording URL
    const url = `${TAALK_API_BASE}/api/calls/${recordingId}/recording?db=${dbName}`;
    
    console.log(`Accessing recording at ${url} with web session authentication...`);
    
    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthenticatedHeaders(),
      agent: httpsAgent
    });
    
    console.log(`Recording access response status: ${response.status}`);
    
    return response;
  } catch (error) {
    console.error('Error accessing recording with web session:', error);
    throw error;
  }
}