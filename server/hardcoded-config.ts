// HARD-CODED CONFIGURATION - NO ENVIRONMENT VARIABLES NEEDED
// This file contains all the configuration values that would normally come from environment variables

export const HARDCODED_CONFIG = {
  // Redis fallback when process.env.REDIS_URL is unset (Railway private network only). Web + worker use server/redis-config getRedisUrl().
  REDIS_URL: 'redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@redis.railway.internal:6379',

  // Twilio Account Keys - Updated with your new working account
  TWILIO_ACCOUNT_SID: 'AC25d37aa41aed0df4fddd81ecf7abf00d',
  TWILIO_AUTH_TOKEN: '974557c999ed53ada16c4a784af2a7d3',
  
  // Twilio API Keys for WebRTC tokens - Your new API key
  TWILIO_API_KEY: 'SKda62cc0dd6b62fa233efbfbb67c5aaf5',
  TWILIO_API_SECRET: 'dNeGYk0Wj8KXp2PghiHuz7GVa4OmAYtX',
  
  // Twilio App and Phone SIDs - Your new TwiML app
  TWILIO_TWIML_APP_SID: 'AP958ebb1810e2315e9ff008cc06e91c1d',
  TWILIO_PHONE_NUMBER_SID: 'PNa1d67508986206fa137ef97f239314d7',
  TWILIO_PHONE_NUMBER: '+19142289324',

  // TaskRouter for inbound voice routing (provisioned via npm run provision-taskrouter)
  TWILIO_TASKROUTER_WORKSPACE_SID: 'WS6a978202496f59f6cd478c1310f5c2eb',
  TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID: 'WW7c3e36b25267cd0489d855dd0b195f3e',

  // Production app URL (aoirail only; no baa2)
  PRODUCTION_URL: 'https://aoirail-production.up.railway.app',
  // Base URL for Twilio webhooks, 609 inbound, and assignment callback. Same as production.
  WEBHOOK_BASE_URL: 'https://aoirail-production.up.railway.app',
  
  // Session and Security
  SESSION_SECRET: 'ao-precheck-production-secret-2024',
  
  // Database - Use Replit database URL or fallback to Neon
  DATABASE_URL: process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
  
  // Supabase Configuration
  SUPABASE_URL: 'https://ycztjetxwpfgtrzeyytt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
  
  // S3 Storage Configuration for Supabase
  S3_ACCESS_KEY_ID: '28d0095786f39a89e8f40f73b9015357',
  S3_SECRET_ACCESS_KEY: 'e5a1acbe3f9c68a569e33e70e27a6651a9d720fdd07beb0398626ae2ab7db967',
  S3_ENDPOINT: 'https://ycztjetxwpfgtrzeyytt.storage.supabase.co/storage/v1/s3',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'verify_agent_screenshot',
  
  // Whereby API Key - UPDATED November 5, 2025
  WHEREBY_API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzYyMzgzNDQyLCJvcmdhbml6YXRpb25JZCI6MzIyMzg4LCJqdGkiOiIwZDVhODdjZC01MmZjLTRjZTctOGZiZC1iMWMxMTFlNDI0MTMifQ.To1zA1SWOJaUxoE70fSiep5n798cp5yPXX6AgoLgUAI',
  
  // OpenAI API Key - SCREENSHOT VALIDATION ONLY
  OPENAI_API_KEY: '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',
  
  // IPinfo.io API Key - IP Geolocation (better accuracy than ip-api.com)
  IPINFO_API_KEY: '4dbb9166a24cc6',
  
  // Stripe (if needed)
  STRIPE_SECRET_KEY: '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',
  STRIPE_PUBLISHABLE_KEY: 'pk_live_51QUWLbDB901D7nogTsLhaocdKc8HT8jWMs6F43v8CSeB9E8wUdg9RAh4K4ZpSUV0lY9eOVi6Sd8a5OrfaV9EnCtE00eKP0VSwF',
  
  // Other settings - Use environment variables if available, fallback to hardcoded values
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: process.env.PORT || 5000
};

// Helper function to get config values (replaces process.env)
export function getConfig(key: keyof typeof HARDCODED_CONFIG): string {
  return String(HARDCODED_CONFIG[key]);
}

// Helper function to check if config exists
export function hasConfig(key: keyof typeof HARDCODED_CONFIG): boolean {
  return !!HARDCODED_CONFIG[key];
}

// Get the base URL for the current environment (works on Railway, Replit, anywhere)
export function getBaseUrl(req?: any): string {
  // Priority 1: Explicit APP_URL environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  
  // Priority 2: Railway auto-generated domain
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  
  // Priority 3: Render.com domain
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  // Priority 4: From request headers (works anywhere)
  if (req) {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  
  // Priority 5: Fallback to current Replit production URL
  return HARDCODED_CONFIG.PRODUCTION_URL;
}

// Export individual values for easy access
export const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWILIO_TWIML_APP_SID,
  TWILIO_PHONE_NUMBER_SID,
  TWILIO_PHONE_NUMBER,
  TWILIO_TASKROUTER_WORKSPACE_SID,
  TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
  WHEREBY_API_KEY,
  OPENAI_API_KEY,
  IPINFO_API_KEY,
  PRODUCTION_URL,
  WEBHOOK_BASE_URL,
  SESSION_SECRET,
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  NODE_ENV,
  PORT
} = HARDCODED_CONFIG;

// Alias for compatibility
export const S3_BUCKET_NAME = S3_BUCKET; 