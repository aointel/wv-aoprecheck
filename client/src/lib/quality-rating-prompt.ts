export const QUALITY_SURVEY_FORCE_SESSION_KEY = 'aoi_quality_survey_force_preview';

/** Read ?qualitySurvey=1 or #qualitySurvey=1 and persist so SPA redirects do not drop the flag. */
export function syncQualitySurveyForceFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('qualitySurvey') === '1') {
      sessionStorage.setItem(QUALITY_SURVEY_FORCE_SESSION_KEY, '1');
      return;
    }
    const rawHash = window.location.hash.replace(/^#/, '');
    if (!rawHash) return;
    const hp = new URLSearchParams(rawHash);
    if (hp.get('qualitySurvey') === '1') {
      sessionStorage.setItem(QUALITY_SURVEY_FORCE_SESSION_KEY, '1');
    }
  } catch {
    /* ignore */
  }
}

/** True when we should run the “forced” survey flow (timer / skip daily key). */
export function isQualitySurveyForcePreviewActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('qualitySurvey') === '1') return true;
    if (sessionStorage.getItem(QUALITY_SURVEY_FORCE_SESSION_KEY) === '1') return true;
    const rawHash = window.location.hash.replace(/^#/, '');
    if (!rawHash) return false;
    return new URLSearchParams(rawHash).get('qualitySurvey') === '1';
  } catch {
    return false;
  }
}

export function clearQualitySurveyForcePreview(): void {
  try {
    sessionStorage.removeItem(QUALITY_SURVEY_FORCE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Wait this long after first agent-surface visit before the normal daily survey may appear. */
export const QUALITY_SURVEY_POST_FIRST_AGENT_PATH_MS = 30 * 60 * 1000;

const firstAgentPathMsKey = (email: string) =>
  `aoi_quality_first_agent_path_ms_${email.trim().toLowerCase()}`;

/**
 * Total ms from now until we should fire the normal daily survey timer (post-login window + small UX delay).
 * Persists first-seen timestamp per email when first called; only call after path/user guards pass.
 */
export function getQualitySurveyNormalTimerTotalMs(
  email: string,
  postEligibilityDelayMs = 4500,
): number {
  if (typeof window === 'undefined') {
    return QUALITY_SURVEY_POST_FIRST_AGENT_PATH_MS + postEligibilityDelayMs;
  }
  try {
    const k = firstAgentPathMsKey(email);
    let first = localStorage.getItem(k);
    if (!first) {
      const now = Date.now();
      localStorage.setItem(k, String(now));
      first = String(now);
    }
    const eligibleAt = Number(first) + QUALITY_SURVEY_POST_FIRST_AGENT_PATH_MS;
    return Math.max(0, eligibleAt - Date.now()) + postEligibilityDelayMs;
  } catch {
    return QUALITY_SURVEY_POST_FIRST_AGENT_PATH_MS + postEligibilityDelayMs;
  }
}

/** Calendar day in America/Los_Angeles (YYYY-MM-DD) — matches server `rated_date`. */
export function getPacificYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

export function getQualityRatingLocalStorageKey(email: string, pacificYmd: string): string {
  return `aoi_quality_rating_${email.trim().toLowerCase()}_${pacificYmd}`;
}

const AGENT_APP_FIRST_SEGMENTS = new Set([
  'connect',
  'dashboard',
  'accountability',
  'analytics',
  'upload',
  'subscription',
  'ao-connect-billing',
  'manager-billing',
  'call-monitoring',
  'live-call-board',
  'aoi-reports',
  'master-aoi-reports',
  'welcome',
  'start',
  'achievements',
  'war-reports',
  'verification-results',
]);

/** Limit prompt to main agent surfaces (not login, verify flows, public vanity, etc.). */
export function shouldPromptQualityRatingOnPath(pathname: string): boolean {
  const raw = pathname.split('?')[0] || '';
  const p = raw.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '') return false;
  if (p.startsWith('/dashboard')) return true;
  if (p === '/connect' || p.startsWith('/connect/')) return true;
  const first = p.split('/').filter(Boolean)[0]?.toLowerCase();
  return first ? AGENT_APP_FIRST_SEGMENTS.has(first) : false;
}
