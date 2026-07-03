import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService, supabase } from '@/lib/auth';

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
  zoomId?: string;
  zoomPassword?: string;
  profilePicture?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: producerProfile | null;
  session: any;
  loading: boolean;
  initialized: boolean;
}

const AuthContext = createContext<{
  authState: AuthState;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    primaryMarket?: string,
    secondaryMarket?: string,
    aoiRecruitOptIn?: boolean,
    aoiModules?: string[],
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<producerProfile>) => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const AUTH_NULL_GRACE_COUNT_KEY = 'aoi_auth_null_grace_count';
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    initialized: false
  });

  useEffect(() => {
    /** Never block the login screen on session: slow/queued server must not stall the SPA for minutes. */
    const SESSION_FETCH_TIMEOUT_MS = 3500;
    const getSessionFetchHeaders = async (): Promise<Record<string, string>> => {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      } catch {
        // Bearer fallback is best-effort.
      }
      try {
        const raw = localStorage.getItem('current_producer');
        if (raw) {
          const parsed = JSON.parse(raw);
          const email = typeof parsed?.email === 'string' ? parsed.email.trim() : '';
          if (email.includes('@')) {
            headers['x-user-email'] = email;
          }
        }
      } catch {
        // local fallback is optional
      }
      return headers;
    };

    const applyServerSession = (sessionData: {
      user?: { id: string; email: string; created_at?: string };
      profile?: unknown;
    }) => {
      const serverUser = sessionData?.user;
      if (serverUser?.email) {
        sessionStorage.removeItem(AUTH_NULL_GRACE_COUNT_KEY);
        const userData = { id: serverUser.id, email: serverUser.email, created_at: serverUser.created_at };
        if (window.electron?.setUserEmail) window.electron.setUserEmail(userData.email);
        localStorage.setItem('current_producer', JSON.stringify(userData));
        setAuthState({
          user: userData,
          profile: (sessionData.profile as producerProfile) || userData,
          session: { user: userData },
          loading: false,
          initialized: true,
        });
        setTimeout(async () => {
          try {
            const res = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(userData.email)}`, {
              credentials: 'include',
            });
            if (res.ok) {
              const freshProfile = await res.json();
              if (freshProfile)
                setAuthState((prev) => ({
                  ...prev,
                  profile: { ...userData, ...freshProfile, id: freshProfile.id?.toString() || userData.id },
                }));
            }
          } catch (e) {
            console.warn('⚠️ Background profile update failed:', e);
          }
        }, 100);
        return;
      }

      // Service boundaries (especially in Electron) can intermittently miss cookies.
      // Preserve cached auth instead of forcing logout when session payload is empty.
      const cachedUserRaw = localStorage.getItem('current_producer');
      const currentPath = window.location.pathname || '';
      if (cachedUserRaw) {
        try {
          const cachedUser = JSON.parse(cachedUserRaw);
          const cachedEmail = typeof cachedUser?.email === 'string' ? cachedUser.email : '';
          if (cachedEmail.includes('@')) {
            const prevGraceCount = Number(sessionStorage.getItem(AUTH_NULL_GRACE_COUNT_KEY) || '0');
            const nextGraceCount = prevGraceCount + 1;
            sessionStorage.setItem(AUTH_NULL_GRACE_COUNT_KEY, String(nextGraceCount));
            console.warn(
              `⚠️ Session returned empty on ${currentPath}; preserving cached auth (grace ${nextGraceCount})`,
            );
            setAuthState({
              user: cachedUser,
              profile: cachedUser,
              session: { user: cachedUser },
              loading: false,
              initialized: true,
            });
            return;
          }
        } catch {
          // fall through to normal clear path
        }
      }

      sessionStorage.removeItem(AUTH_NULL_GRACE_COUNT_KEY);
      setAuthState({ user: null, profile: null, session: null, loading: false, initialized: true });
    };

    const reconcileSessionInBackground = () => {
      void getSessionFetchHeaders()
        .then((headers) =>
          fetch('/api/auth/session', {
            credentials: 'include',
            headers,
          }),
        )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data === 'object') applyServerSession(data as { user?: { id: string; email: string; created_at?: string }; profile?: unknown });
        })
        .catch(() => {});
    };

    const initAuth = async () => {
      try {
        if (typeof window === 'undefined') {
          setAuthState((prev) => ({ ...prev, loading: false, initialized: true }));
          return;
        }

        let sessionRes: Response | null = null;
        try {
          const ac = new AbortController();
          const t = window.setTimeout(() => ac.abort(), SESSION_FETCH_TIMEOUT_MS);
          try {
            const headers = await getSessionFetchHeaders();
            sessionRes = await fetch('/api/auth/session', {
              credentials: 'include',
              headers,
              signal: ac.signal,
            });
          } finally {
            window.clearTimeout(t);
          }
        } catch (e) {
          if (!(e instanceof Error && e.name === 'AbortError')) {
            console.warn('Auth session fetch failed:', e);
          }
        }

        if (sessionRes?.ok) {
          const sessionData = await sessionRes.json().catch(() => ({}));
          applyServerSession(sessionData);
          return;
        }

        // Timeout, network error, or non-OK: unlock UI immediately, then reconcile when the server answers.
        const storedUser = localStorage.getItem('current_producer');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            if (userData?.email) {
              if (window.electron?.setUserEmail) window.electron.setUserEmail(userData.email);
              setAuthState({
                user: userData,
                profile: userData,
                session: { user: userData },
                loading: false,
                initialized: true,
              });
              reconcileSessionInBackground();
              return;
            }
          } catch {
            localStorage.removeItem('current_producer');
          }
        }
        localStorage.removeItem('current_producer');
        setAuthState({ user: null, profile: null, session: null, loading: false, initialized: true });
        reconcileSessionInBackground();
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setAuthState((prev) => ({ ...prev, loading: false, initialized: true }));
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Normalize email to lowercase and trim whitespace
      const normalizedEmail = email.toLowerCase().trim();
      
      console.log(`🔐 Authenticating user: ${normalizedEmail}`);
      setAuthState(prev => ({ ...prev, loading: true }));
      
      // CRITICAL: Actually verify credentials with backend before allowing login
      const authResponse = await authService.login({
        email: normalizedEmail,
        password: password
      });
      
      if (!authResponse.success) {
        throw new Error(authResponse.error || 'Authentication failed');
      }
      
      console.log('✅ Authentication successful for:', normalizedEmail);
      
      // Now that credentials are verified, create user object from the authenticated response
      const userData = {
        id: authResponse.user.id,
        email: authResponse.user.email,
        firstName: authResponse.profile?.firstName || normalizedEmail.split('@')[0],
        lastName: authResponse.profile?.lastName || 'producer',
        isAdmin: authResponse.user.email?.endsWith('@aoglobelife.com') || false,
        phone: authResponse.profile?.phone || '',
        zoomId: authResponse.profile?.zoomId || '',
        zoomPassword: authResponse.profile?.zoomPassword || '1',
        profilePicture: authResponse.profile?.profilePicture || '',
        createdAt: authResponse.user.created_at || new Date().toISOString(),
        updatedAt: authResponse.profile?.updatedAt || new Date().toISOString()
      };
      
      const profileData = authResponse.profile ? {
        id: authResponse.profile.id?.toString() || userData.id,
        email: authResponse.profile.email || normalizedEmail,
        firstName: authResponse.profile.firstName || userData.firstName,
        lastName: authResponse.profile.lastName || userData.lastName,
        phone: authResponse.profile.phone || '',
        zoomId: authResponse.profile.zoomId || '',
        zoomPassword: authResponse.profile.zoomPassword || '1',
        profilePicture: authResponse.profile.profilePicture || '',
        isAdmin: userData.isAdmin,
        createdAt: authResponse.profile.createdAt || userData.createdAt,
        updatedAt: authResponse.profile.updatedAt || userData.updatedAt,
        mgaTeam: (authResponse.profile as any).mgaTeam || '',
        rgaTeam: (authResponse.profile as any).rgaTeam || '',
      } : userData;
      
      // Only store in localStorage AFTER successful authentication
      localStorage.setItem('current_producer', JSON.stringify(userData));
      
      console.log('✅ User authenticated and session created:', normalizedEmail);
      
      // CRITICAL: Tell Electron about the user email for HP Pro auto-capture
      if (window.electron?.setUserEmail) {
        window.electron.setUserEmail(normalizedEmail);
        console.log('📧 Sent user email to Electron:', normalizedEmail);
      }
      
      setAuthState({
        user: userData,
        profile: profileData,
        session: { user: userData },
        loading: false,
        initialized: true
      });
    } catch (error) {
      console.log(`❌ Authentication failed for ${email}:`, error);
      setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
      throw error;
    }
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    primaryMarket?: string,
    secondaryMarket?: string,
    aoiRecruitOptIn?: boolean,
    aoiModules?: string[],
  ) => {
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
        aoiRecruitOptIn,
        aoiModules,
      });
      
      if (!response.success) {
        setAuthState(prev => ({ ...prev, loading: false }));
        // Create error with response data for proper handling
        const error = new Error(response.error || 'Signup failed') as any;
        error.requiresAssistance = response.requiresAssistance;
        error.assistanceEmail = response.assistanceEmail;
        error.message = response.message || response.error || 'Signup failed';
        throw error;
      }
      
      // Don't auto-login - user needs to verify email first
      console.log('✅ Signup successful - email verification required');
    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase first
      // Sign out from Supabase (best-effort — app uses express sessions, not Supabase JWT)
      try { await supabase.auth.signOut(); } catch (_) {}
      
      // Then sign out from our backend
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
      
      // Clear all localStorage
      localStorage.removeItem('current_producer');
      localStorage.removeItem('user_email');
      localStorage.removeItem('supabase.auth.token');
      
      setAuthState({
        user: null,
        profile: null,
        session: null,
        loading: false,
        initialized: true
      });
      
      // Force redirect to login page
      console.log('✅ Logout successful - redirecting to login');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<producerProfile>) => {
    try {
      console.log('🔄 Updating profile via Supabase agent_profiles table:', updates);
      
      const response = await fetch('/api/agent/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Profile update failed:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to update profile`);
      }

      const updatedProfile = await response.json();
      console.log('✅ Profile updated successfully in Supabase:', updatedProfile.email);
      
      setAuthState(prev => ({
        ...prev,
        profile: updatedProfile
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