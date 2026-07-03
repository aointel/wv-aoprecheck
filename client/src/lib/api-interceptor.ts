/**
 * Global API Interceptor
 * Catches 426 errors and redirects to downloads page
 */

// Store original fetch
const originalFetch = window.fetch;

// Track if we've already redirected (prevent loop)
let hasRedirected = false;

// Override global fetch to intercept 426 responses
window.fetch = async (...args) => {
  // If already on downloads page, DON'T intercept - let API calls fail
  if (window.location.pathname === '/downloads') {
    return originalFetch(...args);
  }
  
  const response = await originalFetch(...args);
  
  // If 426 Upgrade Required, redirect to downloads (ONCE)
  if (response.status === 426 && !hasRedirected) {
    hasRedirected = true; // Prevent multiple redirects
    
    try {
      const error = await response.clone().json();
      console.error('❌ UPDATE REQUIRED:', error);
      
      // Redirect immediately without alert spam
      window.location.href = '/downloads';
    } catch (e) {
      console.error('Failed to parse 426 error:', e);
      window.location.href = '/downloads';
    }
    
    // Return the response anyway (won't matter since we're redirecting)
    return response;
  }
  
  return response;
};

console.log('✅ API interceptor loaded - will redirect on 426 errors');

