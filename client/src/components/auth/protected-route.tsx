import { type ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { PageLoader } from '@/components/ui/custom-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX } from 'lucide-react';
import type { PageKey } from '@shared/schema';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPage?: PageKey; // Optional page-level permission check
}

export function ProtectedRoute({ children, requiredPage }: ProtectedRouteProps) {
  const { authState } = useAuth();
  const { canAccessPage, isLoading: permissionsLoading, error } = usePermissions();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isVerificationPath =
    currentPath.startsWith('/dashboard/verification-start') ||
    currentPath.startsWith('/verification') ||
    currentPath.includes('/precheck');
  const hasCachedProducer = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('current_producer');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return typeof parsed?.email === 'string' && parsed.email.includes('@');
    } catch {
      return false;
    }
  })();

  // Show loader while checking auth
  if (authState.loading || !authState.initialized) {
    return <PageLoader text="Checking authentication..." />;
  }

  // Redirect to login if no user - use Redirect component to avoid hooks violations
  if (!authState.user) {
    if (isVerificationPath && hasCachedProducer) {
      // Safety valve for segmented services: do not hard-bounce Precheck users to login
      // when we still have a cached authenticated identity.
      return <>{children}</>;
    }
    return <Redirect to="/login" />;
  }


  // If no specific page is required, just check authentication
  if (!requiredPage) {
    return <>{children}</>;
  }

  // Loading permissions
  if (permissionsLoading && authState.initialized) {
    return <PageLoader />;
  }

  // Permission check failed - show access denied
  if (!canAccessPage(requiredPage)) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <ShieldX className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <CardTitle className="text-xl font-bold text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </p>
            <p className="text-sm text-gray-500">
              Required permission: <code className="bg-gray-100 px-2 py-1 rounded">{requiredPage}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}