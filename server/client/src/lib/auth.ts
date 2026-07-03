import { createClient, type User, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteGVobXRseWxudXVpdWFwbW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ4MDQ4MzEsImV4cCI6MjA0MDM4MDgzMX0.Q3ivZmMmtOSSbK-C5Wf72FtJGrA1vMmJ6Q4SrT9ZFDY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
}

export interface AgentProfile {
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
  aoiRecruitOptIn?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  profile: AgentProfile | null;
  session: Session | null;
  loading: boolean;
}

// Auth helper functions
export const authService = {
  async login(credentials: LoginCredentials) {
    // Use backend API instead of direct Supabase calls
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for session management
      body: JSON.stringify(credentials)
    });
    
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
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }
    
    return response.json();
  },


};