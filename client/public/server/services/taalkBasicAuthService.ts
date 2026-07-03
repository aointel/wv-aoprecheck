/**
 * TaalkAI Basic Authentication Service
 * A simple, direct approach using Basic Auth for accessing TaalkAI recordings
 */

/**
 * Get a recording from TaalkAI API using direct URL with credentials
 * @param recordingId The ID of the recording
 * @param dbName The database name to use (usually 'michaelmandella')
 * @returns Response from the TaalkAI API
 */
export async function getRecording(recordingId: string, dbName: string = 'michaelmandella'): Promise<Response> {
  // Try multiple credential formats
  const attempts = [
    // Attempt 1: Use the full email and password with query parameters
    {
      username: 'michaelmandella@aoglobelife.com',
      password: 'Aoletsgrow24!',
      authType: 'query'
    },
    // Attempt 2: Use username without domain
    {
      username: 'michaelmandella',
      password: 'Aoletsgrow24!',
      authType: 'basic'
    },
    // Attempt 3: Try without authentication to see if URL itself works
    {
      username: '',
      password: '',
      authType: 'none'
    }
  ];
  
  // Base URL for the TaalkAI API
  const apiBaseUrl = 'https://api.taalk.ai';
  
  console.log(`TaalkBasicAuthService: Testing multiple authentication approaches for recording ID ${recordingId}`);
  
  let lastResponse: Response | null = null;
  
  // Try each approach
  for (const attempt of attempts) {
    try {
      // Construct the URL based on authentication type
      let url = `${apiBaseUrl}/api/calls/${recordingId}/recording?db=${dbName}`;
      
      if (attempt.authType === 'query') {
        url += `&username=${encodeURIComponent(attempt.username)}&password=${encodeURIComponent(attempt.password)}`;
      }
      
      console.log(`TaalkBasicAuthService: Attempt with ${attempt.authType} auth, username: ${attempt.username}`);
      console.log(`TaalkBasicAuthService: Accessing recording at ${url.replace(/password=.*?(&|$)/, 'password=REDACTED$1')}`);
      
      // Set request headers
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*',
        'Origin': 'https://lets.taalk.ai',
        'Referer': 'https://lets.taalk.ai/'
      };
      
      // Add authorization header for basic auth
      if (attempt.authType === 'basic' && attempt.username && attempt.password) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${attempt.username}:${attempt.password}`).toString('base64');
      }
    
      // Make the request
      console.log(`TaalkBasicAuthService: Sending request with ${attempt.authType} auth`);
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      console.log(`TaalkBasicAuthService: Response status: ${response.status}`);
      
      // Check if there's an error
      if (!response.ok) {
        console.error(`TaalkBasicAuthService: Error - ${response.status} ${response.statusText}`);
        
        // Try to log the response body for debugging
        const text = await response.text().catch(() => 'Could not read response body');
        console.error(`TaalkBasicAuthService: Response body - ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      } else {
        // If this attempt worked, return the successful response
        console.log(`TaalkBasicAuthService: Authentication successful with ${attempt.authType} method!`);
        return response;
      }
      
      // Save the response for potential fallback
      lastResponse = response;
    } catch (error) {
      console.error('TaalkBasicAuthService: Exception occurred:', error);
      // Continue with the next attempt rather than stopping on error
      console.log('TaalkBasicAuthService: Continuing to next authentication method...');
    }
  }
  
  // If we reach here, all attempts failed
  console.log('TaalkBasicAuthService: All authentication attempts failed');
  
  // Return the last response (which will be a failed response)
  if (lastResponse) {
    return lastResponse;
  }
  
  // If we have no response at all, create a synthetic error response
  throw new Error('All authentication methods failed and no response was available');
}