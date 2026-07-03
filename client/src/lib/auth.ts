import { type User, type Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Re-export supabase client from single source
export { supabase };

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
}

export interface producerProfile {
  id: number;
  supabaseUserId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zoomId?: string;
  zoomPassword?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  firstName: string;
  lastName: string;
  phone: string;
  zoomId?: string;
  zoomPassword?: string;
  primaryMarket?: string;
  secondaryMarket?: string;
  /** Connect, recruit, precheck — sections applying for at signup */
  aoiModules?: string[];
  aoiRecruitOptIn?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  profile: producerProfile | null;
  session: Session | null;
  loading: boolean;
}

// Auth helper functions
export const authService = {
  async login(credentials: LoginCredentials) {
    const LOGIN_TIMEOUT_MS = 15000;
    const LOGIN_RETRY_DELAYS_MS = [300];

    async function loginAttempt(): Promise<Response> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
      try {
        return await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(credentials),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    }

    // Use backend API instead of direct Supabase calls
    let response: Response | null = null;
    for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
      try {
        response = await loginAttempt();
        if ([408, 425, 429, 500, 502, 503, 504].includes(response.status) && attempt < LOGIN_RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, LOGIN_RETRY_DELAYS_MS[attempt]));
          continue;
        }
        break;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Login timed out. Please try again.');
        }
        const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
        const isTransient = message.includes('failed to fetch') || message.includes('network');
        if (!isTransient || attempt >= LOGIN_RETRY_DELAYS_MS.length) throw error;
        await new Promise((r) => setTimeout(r, LOGIN_RETRY_DELAYS_MS[attempt]));
      }
    }

    if (!response) {
      throw new Error('Login request failed before receiving a response');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    
    return response.json();
  },

  async signup(credentials: SignupCredentials) {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      // Create error with full response data for proper handling
      const error = new Error(responseData.error || responseData.message || 'Signup failed') as any;
      error.requiresAssistance = responseData.requiresAssistance;
      error.assistanceEmail = responseData.assistanceEmail;
      error.message = responseData.message || responseData.error || 'Signup failed';
      error.responseData = responseData; // Preserve full response
      throw error;
    }
    
    return responseData;
  },


};