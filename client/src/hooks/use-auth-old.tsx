import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '@/lib/auth';

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface producerProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zoomMeetingId?: string;
  zoomPassword?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: producerProfile | null;
  session: any;
  loading: boolean;
}

const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<producerProfile>) => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true
  });

  useEffect(() => {
    // Check for existing session on app load
    checkExistingSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          // User signed in, fetch profile
          try {
            const profileResponse = await fetch('/api/auth/profile', {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            const profileData = profileResponse.ok ? await profileResponse.json() : { profile: null };
            
            setAuthState({
              user: {
                id: session.user.id,
                email: session.user.email!,
                isAdmin: profileData.profile?.isAdmin || false
              },
              profile: profileData.profile,
              session,
              loading: false
            });
          } catch (error) {
            console.error('Error fetching profile on sign in:', error);
            setAuthState({
              user: {
                id: session.user.id,
                email: session.user.email!,
                isAdmin: false
              },
              profile: null,
              session,
              loading: false
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setAuthState({
            user: null,
            profile: null,
            session: null,
            loading: false
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkExistingSession = async () => {
    try {
      // Set loading true during session check
      setAuthState(prev => ({ ...prev, loading: true }));
      
      // Check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth session error:', error);
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false
        });
        return;
      }

      if (session?.user) {
        // User is authenticated, fetch their profile
        try {
          const profileResponse = await fetch('/api/auth/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            
            setAuthState({
              user: {
                id: session.user.id,
                email: session.user.email!,
                isAdmin: profileData.profile?.isAdmin || false
              },
              profile: profileData.profile,
              session,
              loading: false
            });
          } else {
            // Profile not found, user needs to complete setup
            setAuthState({
              user: {
                id: session.user.id,
                email: session.user.email!,
                isAdmin: false
              },
              profile: null,
              session,
              loading: false
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setAuthState({
            user: {
              id: session.user.id,
              email: session.user.email!,
              isAdmin: false
            },
            profile: null,
            session,
            loading: false
          });
        }
      } else {
        // No session, user not authenticated
        setAuthState({
          user: null,
          profile: null,
          session: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Session check error:', error);
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false
      });
    }
  };



  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      // Use backend API for authentication
      const response = await authService.login({ email, password });
      
      if (!response.success) {
        setAuthState(prev => ({ ...prev, loading: false }));
        throw new Error(response.error || 'Login failed');
      }

      if (response.user) {
        // Set auth state with response data
        setAuthState({
          user: {
            id: response.user.id,
            email: response.user.email,
            isAdmin: response.profile?.isAdmin || false
          },
          profile: response.profile,
          session: null, // Backend handles sessions
          loading: false
        });
      }
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false
      });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<producerProfile>) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      
      const updatedData = await response.json();
      setAuthState(prev => ({
        ...prev,
        profile: updatedData.profile
      }));
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout, updateProfile }}>
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