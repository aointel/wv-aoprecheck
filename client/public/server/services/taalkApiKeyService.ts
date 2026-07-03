/**
 * TaalkAI API Key Based Authentication Service
 * This service uses the proper JWT token approach for API authentication
 */

// Avoid showing credentials in logs
const REDACTED = '[REDACTED]';

/**
 * Get a recording from TaalkAI API using JWT token authentication
 * @param recordingId The ID of the recording
 * @param dbName The database name to use (usually 'michaelmandella')
 * @returns Response from the TaalkAI API
 */
export async function getRecording(recordingId: string, dbName: string = 'michaelmandella'): Promise<Response> {
  // Get the API credentials from environment variables
  const apiKey = process.env.TAALK_API_KEY;
  
  if (!apiKey) {
    console.error('TaalkApiKeyService: TAALK_API_KEY environment variable is not set');
    throw new Error('TAALK_API_KEY environment variable is required');
  }
  
  // Base URL for the TaalkAI API
  const apiBaseUrl = 'https://api.taalk.ai';
  
  // Construct the URL for the recording
  const url = `${apiBaseUrl}/api/calls/${recordingId}/recording?db=${dbName}`;
  
  console.log(`TaalkApiKeyService: Accessing recording at ${url}`);
  
  try {
    // Set request headers with Bearer token
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
      'Origin': 'https://lets.taalk.ai',
      'Referer': 'https://lets.taalk.ai/'
    };
    
    // Make the request
    console.log(`TaalkApiKeyService: Sending request with JWT token: Bearer ${apiKey.substring(0, 15)}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log(`TaalkApiKeyService: Response status: ${response.status}`);
    
    // Check if there's an error
    if (!response.ok) {
      console.error(`TaalkApiKeyService: Error - ${response.status} ${response.statusText}`);
      
      // Try to log the response body for debugging
      const text = await response.text().catch(() => 'Could not read response body');
      console.error(`TaalkApiKeyService: Response body - ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    } else {
      console.log('TaalkApiKeyService: Successfully retrieved recording');
    }
    
    return response;
  } catch (error) {
    console.error('TaalkApiKeyService: Exception occurred:', error);
    throw error;
  }
}