import { type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/login';
import { PageLoader } from '@/components/ui/custom-loader';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authState } = useAuth();

  // Debug logging to see what's happening
  console.log('🔒 ProtectedRoute state:', {
    loading: authState.loading,
    initialized: authState.initialized,
    hasUser: !!authState.user,
    userEmail: authState.user?.email,
    hasProfile: !!authState.profile
  });

  // Show loader while still initializing auth or during loading
  if (authState.loading || !authState.initialized) {
    console.log('🔒 ProtectedRoute: Showing loader');
    return <PageLoader text="Authenticating..." />;
  }

  // Only redirect to login if auth is fully initialized and no user found
  if (authState.initialized && !authState.user) {
    console.log('🔒 ProtectedRoute: Redirecting to login - no user found');
    return <LoginPage />;
  }

  console.log('🔒 ProtectedRoute: Authentication successful, rendering children');
  return <>{children}</>;
}