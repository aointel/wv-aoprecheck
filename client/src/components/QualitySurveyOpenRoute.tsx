import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { QUALITY_SURVEY_FORCE_SESSION_KEY } from '@/lib/quality-rating-prompt';

/**
 * Visit /open-quality-survey while logged in to open the ConnectNow check-in modal immediately.
 * Sets the same session flag as ?qualitySurvey=1 and dispatches a global event (bypasses timers).
 */
export function QualitySurveyOpenRoute() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authState.initialized) return;
    try {
      sessionStorage.setItem(QUALITY_SURVEY_FORCE_SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('aoirail-open-quality-survey'));
    setLocation(authState.user?.email ? '/connect' : '/login');
  }, [authState.initialized, authState.user?.email, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-blue-950/30">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 p-4 shadow-xl">
          <svg className="h-8 w-8 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
          Loading your daily check-in…
        </p>
      </div>
    </div>
  );
}
