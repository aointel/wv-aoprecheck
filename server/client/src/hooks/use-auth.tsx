import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService, supabase } from '@/lib/auth';

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface AgentProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zoomMeetingId?: string;
  zoomPassword?: string;
  profilePicture?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: AgentProfile | null;
  session: any;
  loading: boolean;
  initialized: boolean;
}

const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, primaryMarket?: string, secondaryMarket?: string, aoiRecruitOptIn?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AgentProfile>) => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    initialized: false
  });

  useEffect(() => {
    // Check initial auth state on mount with retry logic
    const checkAuth = async (retryCount = 0) => {
      try {
        console.log(`Auth check attempt ${retryCount + 1}`);
        
        // First check if we have a Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        let headers: Record<string, string> = {
          'credentials': 'include'
        };
        
        // If we have a Supabase session, include the access token
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
          console.log('🔑 Including Supabase access token in request');
        }
        
        const response = await fetch('/api/auth/profile', {
          credentials: 'include',
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Auth check successful:', { hasUser: !!data.user, hasProfile: !!data.profile });
          
          // Reset WAR cards on successful login for testing
          if (data.user?.email) {
            console.log('🔄 Resetting WAR cards for testing after login');
            localStorage.removeItem('swipedConnects');
            localStorage.removeItem('creditProgress');
          }
          
          setAuthState({
            user: data.user,
            profile: data.profile,
            session: session,
            loading: false,
            initialized: true
          });
        } else if (response.status === 401) {
          // Confirmed not authenticated - clear any stale Supabase session
          if (session) {
            await supabase.auth.signOut();
          }
          console.log('Auth check: Not authenticated (401)');
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false,
            initialized: true
          });
        } else {
          // Server error - retry if we haven't tried too many times
          if (retryCount < 2) {
            console.log(`Auth check failed with ${response.status}, retrying...`);
            setTimeout(() => checkAuth(retryCount + 1), 1000);
            return;
          } else {
            console.error('Auth check failed after retries');
            setAuthState({
              user: null,
              profile: null,
              session: null,
              loading: false,
              initialized: true
            });
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (retryCount < 2) {
          console.log('Network error, retrying auth check...');
          setTimeout(() => checkAuth(retryCount + 1), 1000);
          return;
        }
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          initialized: true
        });
      }
    };

    checkAuth();
    
    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Supabase auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAuth();
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false,
          initialized: true
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const response = await authService.login({ email, password });
      
      if (!response.success) {
        setAuthState(prev => ({ ...prev, loading: false }));
        throw new Error(response.error || 'Login failed');
      }

      setAuthState({
        user: {
          id: response.user.id,
          email: response.user.email,
          isAdmin: response.profile?.isAdmin || false
        },
        profile: response.profile,
        session: null,
        loading: false,
        initialized: true
      });
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
      throw error;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string, primaryMarket?: string, secondaryMarket?: string, aoiRecruitOptIn?: boolean) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const response = await authService.signup({ 
        email, 
        password, 
        firstName, 
        lastName,
        phone: '', // Phone is optional for signup
        primaryMarket,
        secondaryMarket,
        aoiRecruitOptIn
      });
      
      if (!response.success) {
        setAuthState(prev => ({ ...prev, loading: false }));
        throw new Error(response.error || 'Signup failed');
      }
      
      // Don't auto-login after signup, just finish
      setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase first
      await supabase.auth.signOut();
      
      // Then sign out from our backend
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        initialized: true
      });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<AgentProfile>) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const responseData = await response.json();
      setAuthState(prev => ({
        ...prev,
        profile: responseData.profile
      }));
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ authState, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}