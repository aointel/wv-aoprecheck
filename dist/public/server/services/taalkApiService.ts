/**
 * Service for accessing the TaalkAI API
 * This service manages JWT token and authentication for the TaalkAI API
 */

import { randomBytes, createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

const TAALK_API_BASE = 'https://api.taalk.ai';
const RECORDINGS_DIR = path.join(process.cwd(), 'public', 'recordings');

// Cache the token
let taalkApiToken: string | null = null;
let tokenExpiry: Date | null = null;

// Ensure the recordings directory exists
export async function ensureRecordingsDir() {
  try {
    // Create public directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
      await fsPromises.mkdir(path.join(process.cwd(), 'public'));
      console.log('Created public directory');
    }
    
    // Create recordings directory if it doesn't exist
    if (!fs.existsSync(RECORDINGS_DIR)) {
      await fsPromises.mkdir(RECORDINGS_DIR);
      console.log('Created recordings directory');
    }
  } catch (error) {
    console.error('Error creating recordings directory:', error);
  }
}

// Initialize directories when the module loads
ensureRecordingsDir();

// Default headers for TaalkAI API requests
export function getTaalkApiHeaders(): Record<string, string> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  return {
    'User-Agent': userAgent,
    'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
    'Origin': 'https://lets.taalk.ai',
    'Referer': 'https://lets.taalk.ai/',
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
}

// Create a JWT token for TaalkAI API
export async function createJwtToken(): Promise<string | null> {
  try {
    // Get credentials
    const username = process.env.TAALK_API_USERNAME || 'michaelmandella@aoglobelife.com';
    const password = process.env.TAALK_API_PASSWORD || 'Aoletsgrow24!';
    
    // Generate a random nonce
    const nonce = randomBytes(16).toString('hex');
    
    // Create a timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Hash the password using a simple approach
    // This is a placeholder - the actual API might use a different hashing method
    const hashedPassword = createHash('sha256').update(password).digest('hex');
    
    // Create a token payload
    const payload = {
      username,
      password_hash: hashedPassword,
      nonce,
      timestamp,
      exp: timestamp + 3600 // Token valid for 1 hour
    };
    
    // Convert to base64 for JWT
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // Create a simple JWT (this is a placeholder - real JWT would have signature)
    const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payloadBase64}.signature`;
    
    console.log('Created JWT token for TaalkAI API');
    
    // Update token expiry
    tokenExpiry = new Date(timestamp * 1000 + 3600 * 1000);
    
    return token;
  } catch (error) {
    console.error('Error creating JWT token:', error);
    return null;
  }
}

// Get a valid JWT token, creating a new one if needed
export async function getJwtToken(): Promise<string | null> {
  // If we have a valid cached token, return it
  if (taalkApiToken && tokenExpiry && tokenExpiry > new Date()) {
    return taalkApiToken;
  }
  
  // Otherwise, create a new token
  const token = await createJwtToken();
  
  if (token) {
    taalkApiToken = token;
    return token;
  }
  
  return null;
}

// Handle fallback authentication if the initial request fails
export async function handleTaalkApiAuthFallback(
  initialResponse: Response, 
  url: string
): Promise<Response> {
  console.log('Attempting API auth fallback...');
  
  // Try to create a new JWT token
  const token = await createJwtToken();
  
  if (!token) {
    console.error('Failed to create fallback JWT token');
    return initialResponse;
  }
  
  // Make a new request with the fresh token
  const headers = {
    ...getTaalkApiHeaders(),
    'Authorization': `Bearer ${token}`
  };
  
  console.log('Making fallback request with fresh token');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers
    });
    
    console.log(`Fallback response status: ${response.status}`);
    
    return response;
  } catch (error) {
    console.error('Error in fallback auth request:', error);
    return initialResponse;
  }
}

// Check if a recording is already downloaded
export function isRecordingDownloaded(recordingId: string): boolean {
  const filePath = path.join(RECORDINGS_DIR, `${recordingId}.mp3`);
  return fs.existsSync(filePath);
}

// Get local path for a recording
export function getRecordingLocalPath(recordingId: string): string {
  return path.join(RECORDINGS_DIR, `${recordingId}.mp3`);
}

// Get public URL for a recording
export function getRecordingPublicUrl(recordingId: string): string {
  return `/recordings/${recordingId}.mp3`;
}

// Download a recording from TaalkAI API
export async function downloadRecording(recordingId: string, db: string = 'michaelmandella'): Promise<string | null> {
  // Check if already downloaded
  if (isRecordingDownloaded(recordingId)) {
    console.log(`Recording ${recordingId} already downloaded`);
    return getRecordingPublicUrl(recordingId);
  }
  
  // Ensure directories exist
  await ensureRecordingsDir();
  
  // Get the recording URL
  const url = `${TAALK_API_BASE}/api/calls/${recordingId}/recording?db=${db}`;
  
  // Get a JWT token
  const token = await getJwtToken();
  
  if (!token) {
    console.error('Failed to get JWT token for recording download');
    return null;
  }
  
  // Make the request
  const headers = {
    ...getTaalkApiHeaders(),
    'Authorization': `Bearer ${token}`
  };
  
  try {
    console.log(`Downloading recording ${recordingId}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers
    });
    
    if (!response.ok) {
      console.error(`Failed to download recording ${recordingId}, status: ${response.status}`);
      
      // Try fallback authentication
      const fallbackResponse = await handleTaalkApiAuthFallback(response, url);
      
      if (!fallbackResponse.ok) {
        console.error(`Fallback authentication failed for recording ${recordingId}`);
        return null;
      }
      
      // Save the recording to disk
      const buffer = await fallbackResponse.arrayBuffer();
      const filePath = getRecordingLocalPath(recordingId);
      
      await fsPromises.writeFile(filePath, Buffer.from(buffer));
      console.log(`Saved recording ${recordingId} to ${filePath}`);
      
      return getRecordingPublicUrl(recordingId);
    }
    
    // Save the recording to disk
    const buffer = await response.arrayBuffer();
    const filePath = getRecordingLocalPath(recordingId);
    
    await fsPromises.writeFile(filePath, Buffer.from(buffer));
    console.log(`Saved recording ${recordingId} to ${filePath}`);
    
    return getRecordingPublicUrl(recordingId);
  } catch (error) {
    console.error(`Error downloading recording ${recordingId}:`, error);
    return null;
  }
}