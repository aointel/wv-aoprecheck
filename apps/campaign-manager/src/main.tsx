import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileApp from './MobileApp';
import { AgencyBoard } from './components/AgencyBoard';
import './index.css';

function readSupabaseAccessToken(): string {
  try {
    const keys = Object.keys(localStorage || {});
    const sbKey = keys.find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const raw = localStorage.getItem(sbKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = String(parsed?.access_token || '').trim();
        if (token) return token;
      }
    }
    const legacy = localStorage.getItem('supabase.auth.token');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const token = String(parsed?.currentSession?.access_token || parsed?.access_token || '').trim();
      if (token) return token;
    }
  } catch {}
  return '';
}

const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith('/api/')) {
    const headers = new Headers(init?.headers || {});
    const token = readSupabaseAccessToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return originalFetch(input, { ...(init || {}), headers });
  }
  return originalFetch(input, init);
};

const displayMatch = window.location.pathname.match(/^\/display\/([a-z]+)/i);
const displaySlug = displayMatch ? displayMatch[1].toLowerCase() : null;
const isMobileRoute = /^\/mobile(?:\/|$)/i.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {displaySlug ? <AgencyBoard slug={displaySlug} /> : isMobileRoute ? <MobileApp /> : <App />}
  </React.StrictMode>,
);
