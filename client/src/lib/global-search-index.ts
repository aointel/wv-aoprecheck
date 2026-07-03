/**
 * Global search index for Connect, Recruit, Precheck, Meet, Training, Get Help.
 * Used by the header search bar to navigate to pages and articles.
 */

export interface SearchItem {
  id: string;
  title: string;
  description?: string;
  keywords: string[];
  path: string;
  section: 'connect' | 'recruit' | 'precheck' | 'meet' | 'training' | 'gethelp' | 'billing' | 'intelligence';
  type: 'page' | 'article';
}

export const SEARCH_INDEX: SearchItem[] = [
  // === CONNECT ===
  { id: 'connect-main', title: 'AO Intel / Connect', description: 'Outbound dialing, lead queues, call management', keywords: ['connect', 'dial', 'call', 'outbound', 'lead', 'ao intel'], path: '/dashboard/connect', section: 'connect', type: 'page' },
  { id: 'connect-dialer', title: 'Call Connector', description: 'Outbound dialer, lead queues, dispositions', keywords: ['call connector', 'dialer', 'outbound', 'lead queue', 'disposition'], path: '/dashboard/connect', section: 'connect', type: 'page' },
  { id: 'connect-getting-started', title: 'Getting Started with Call Connector', description: 'Beginner guide to outbound dialing and lead queues', keywords: ['call connector', 'getting started', 'dial', 'lead'], path: '/dashboard/connect', section: 'connect', type: 'article' },
  { id: 'connect-lead-queues', title: 'Lead Queue Strategies', description: 'Organize leads, prioritize calls, My Leads, Hot Leads', keywords: ['lead queue', 'my leads', 'hot leads', 'plus leads', 'priority'], path: '/dashboard/connect', section: 'connect', type: 'article' },
  { id: 'connect-disposition', title: 'Call Disposition Best Practices', description: 'Categorize calls, track outcomes, callback, booked', keywords: ['disposition', 'callback', 'booked', 'not interested', 'no answer'], path: '/dashboard/connect', section: 'connect', type: 'article' },

  // === RECRUIT ===
  { id: 'recruit-main', title: 'AO Recruit', description: 'Candidate management, interview scheduling, team building', keywords: ['recruit', 'candidate', 'interview', 'hiring', 'team'], path: '/dashboard/ao-recruit', section: 'recruit', type: 'page' },
  { id: 'recruit-getting-started', title: 'Getting Started with AO Recruit', description: 'Candidate tracking and interview tools', keywords: ['recruit', 'getting started', 'candidate', 'interview'], path: '/dashboard/ao-recruit', section: 'recruit', type: 'article' },
  { id: 'recruit-team', title: 'Building Your Dream Team', description: 'Identify talent, conduct interviews, onboarding', keywords: ['recruit', 'team', 'talent', 'onboarding', 'interview'], path: '/dashboard/ao-recruit', section: 'recruit', type: 'article' },
  { id: 'recruit-journey', title: 'Candidate Journey Tracking', description: 'Recruitment pipeline, stage tracking, analytics', keywords: ['recruit', 'candidate journey', 'pipeline', 'stages'], path: '/dashboard/ao-recruit', section: 'recruit', type: 'article' },

  // === PRECHECK ===
  { id: 'precheck-main', title: 'AO Precheck', description: 'Verification workflows, screenshot validation, compliance', keywords: ['precheck', 'verification', 'screenshot', 'compliance', 'ai validation'], path: '/dashboard/ao-precheck', section: 'precheck', type: 'page' },
  { id: 'precheck-verification', title: 'Start Verification', description: 'Begin a new verification session', keywords: ['precheck', 'verification', 'start', 'session'], path: '/dashboard/verification-start', section: 'precheck', type: 'page' },
  { id: 'precheck-getting-started', title: 'Getting Started with AO Precheck', description: 'Verification workflows and screenshot validation', keywords: ['precheck', 'verification', 'screenshot', 'getting started'], path: '/dashboard/ao-precheck', section: 'precheck', type: 'article' },
  { id: 'precheck-ai', title: 'AI-Powered Verification', description: 'AI validation, issue detection, compliance', keywords: ['precheck', 'ai', 'verification', 'validation'], path: '/dashboard/ao-precheck', section: 'precheck', type: 'article' },

  // === MEET ===
  { id: 'meet-main', title: 'AO Meet', description: 'Appointment scheduling, Zoom, presentation tracking', keywords: ['meet', 'appointment', 'zoom', 'schedule', 'calendar', 'video'], path: '/dashboard/ao-meet', section: 'meet', type: 'page' },
  { id: 'meet-getting-started', title: 'Getting Started with AO Meet', description: 'Appointment scheduling and Zoom integration', keywords: ['meet', 'appointment', 'zoom', 'getting started'], path: '/dashboard/ao-meet', section: 'meet', type: 'article' },
  { id: 'meet-zoom', title: 'Zoom Integration', description: 'Video meetings, recording, waiting room', keywords: ['meet', 'zoom', 'video', 'meeting'], path: '/dashboard/ao-meet', section: 'meet', type: 'article' },

  // === TRAINING ===
  { id: 'training-main', title: 'AO Training', description: 'Video tutorials, courses, certification', keywords: ['training', 'tutorial', 'course', 'certification', 'learn', 'onboarding'], path: '/onboarding', section: 'training', type: 'page' },
  { id: 'training-getting-started', title: 'Getting Started with Training', description: 'Video tutorials and certification programs', keywords: ['training', 'getting started', 'tutorial', 'certification'], path: '/onboarding', section: 'training', type: 'article' },
  { id: 'training-certification', title: 'Certification Path', description: 'Earn certifications, track progress', keywords: ['training', 'certification', 'progress'], path: '/onboarding', section: 'training', type: 'article' },

  // === GET HELP ===
  { id: 'help-main', title: 'Get Help', description: 'Support, troubleshooting, AOI Support queue', keywords: ['help', 'support', 'troubleshoot', 'get help', 'queue'], path: '/help', section: 'gethelp', type: 'page' },
  { id: 'help-queue', title: 'Help Queue', description: 'Join the AOI Support queue', keywords: ['help', 'queue', 'support', 'wait'], path: '/help', section: 'gethelp', type: 'page' },

  // === INTELLIGENCE (Connect sub-section) ===
  { id: 'intel-main', title: 'AO Intelligence', description: 'AI presentations, analytics, AOI Score', keywords: ['intelligence', 'aoi', 'ai', 'presentation', 'analytics', 'score'], path: '/dashboard/connect', section: 'intelligence', type: 'page' },
  { id: 'intel-aoi-score', title: 'AOI Score', description: 'Performance metrics, dial to connect, closing rate', keywords: ['aoi score', 'metrics', 'performance', 'dial', 'closing'], path: '/dashboard/connect', section: 'intelligence', type: 'article' },

  // === BILLING ===
  { id: 'billing-main', title: 'Billing', description: 'Credits, usage, billing dashboard', keywords: ['billing', 'credits', 'usage', 'payment'], path: '/dashboard/billing-dashboard', section: 'billing', type: 'page' },
];

const SECTION_LABELS: Record<string, string> = {
  connect: 'Connect',
  recruit: 'Recruit',
  precheck: 'Precheck',
  meet: 'Meet',
  training: 'Training',
  gethelp: 'Get Help',
  intelligence: 'AO Intelligence',
  billing: 'Billing',
};

export function searchGlobalSearchIndex(query: string): SearchItem[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  const results: SearchItem[] = [];
  const seen = new Set<string>();

  for (const item of SEARCH_INDEX) {
    const matchTitle = item.title.toLowerCase().includes(q);
    const matchDesc = item.description?.toLowerCase().includes(q);
    const matchKeywords = item.keywords.some(kw => kw.toLowerCase().includes(q) || q.includes(kw.toLowerCase()));
    if ((matchTitle || matchDesc || matchKeywords) && !seen.has(item.id)) {
      seen.add(item.id);
      results.push(item);
    }
  }

  // Sort: exact title match first, then by section
  return results.sort((a, b) => {
    const aExact = a.title.toLowerCase().startsWith(q) ? 1 : 0;
    const bExact = b.title.toLowerCase().startsWith(q) ? 1 : 0;
    if (bExact !== aExact) return bExact - aExact;
    return a.section.localeCompare(b.section);
  });
}

export function getSectionLabel(section: string): string {
  return SECTION_LABELS[section] || section;
}
