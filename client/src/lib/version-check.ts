// Global version check interceptor - REMOVED
// Server now returns HTML page directly, no client-side redirect needed
export function setupVersionCheck() {
  // Do nothing - server handles it with HTML response
  console.log('✅ Version check: Server will handle version errors with HTML page');
}

