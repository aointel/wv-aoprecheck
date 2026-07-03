/**
 * WebRTC Endpoint Utilities
 * Separates Electron and Browser endpoints for Twilio/WebRTC
 */
import { getServiceRequestCredentials, resolveServiceUrl } from '@/lib/service-routing';

/**
 * Detect if running in Electron
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Detect via process.versions.electron when exposed.
  const maybeProcess = (window as any).process;
  if (maybeProcess?.versions?.electron) {
    return true;
  }

  // Check for Electron API
  if ((window as any).electronAPI) {
    return true;
  }
  
  // Check User-Agent
  const ua = navigator.userAgent || '';
  if (ua.includes('AOI-Desktop') || ua.includes('Electron')) {
    return true;
  }
  
  return false;
}

/**
 * Get the correct Twilio token endpoint based on platform
 * - Electron: /api/electron/twilio/token
 * - Browser: /api/twilio/token
 */
export function getTwilioTokenEndpoint(): string {
  const endpoint = isElectron() 
    ? '/api/electron/twilio/token'
    : '/api/twilio/token';
  return resolveServiceUrl(endpoint);
}

/**
 * Init for Twilio voice token fetch: session cookies + optional x-user-email when session lags.
 * Prefer this over legacy `/api/token` (session-only, no Supabase cookie fallback).
 */
export function getTwilioTokenRequestInit(userEmail?: string | null): RequestInit {
  const headers: Record<string, string> = {};
  if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
    headers['x-user-email'] = userEmail.trim().toLowerCase();
  }
  const endpoint = getTwilioTokenEndpoint();
  return {
    credentials: getServiceRequestCredentials(endpoint),
    headers: Object.keys(headers).length ? headers : undefined,
  };
}

/** Fetch JWT for Twilio.Device — correct path per platform + auth headers. */
export function fetchTwilioVoiceToken(userEmail?: string | null): Promise<Response> {
  return fetch(getTwilioTokenEndpoint(), getTwilioTokenRequestInit(userEmail));
}

/**
 * Get the correct WebRTC webhook endpoint based on platform
 * (if needed in the future)
 */
export function getWebRTCWebhookEndpoint(): string {
  const endpoint = isElectron()
    ? '/api/electron/webhook/webrtc'
    : '/webhook/webrtc';
  return resolveServiceUrl(endpoint);
}
