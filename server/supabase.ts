/**
 * Supabase clients for the API server. URL and keys come only from `hardcoded-config.ts`.
 * Do not read SUPABASE_* from process.env here — production auth must stay aligned with that file.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY } from './hardcoded-config';
import { wrapFetchWithPerf } from './perf-observability';
import { shouldBlockHotTableSupabaseWrite } from './hot-table-write-gate';
import { localHotTableClient } from './local-hot-table-client';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;
const supabaseServiceKey = SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.warn('⚠️ Missing Supabase credentials - Supabase features will be disabled');
  console.warn('Edit server/hardcoded-config.ts (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)');
  console.warn('URL:', !!supabaseUrl, 'Anon Key:', !!supabaseAnonKey, 'Service Key:', !!supabaseServiceKey);
} else {
  console.log('✅ Supabase credentials configured properly');
  console.log('🔧 URL:', supabaseUrl.substring(0, 30) + '...');
  console.log('🔧 Key:', supabaseAnonKey.substring(0, 30) + '...');
}

// Regular client with anon key for reads
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        fetch: wrapFetchWithPerf('supabase-anon-http', fetch),
        headers: {
          'Prefer': 'count=exact'
        }
      }
    })
  : null;

/** Bound how long the admin client waits on a stalled TCP connect (reduces pile-up when Supabase is unreachable). */
const SUPABASE_ADMIN_FETCH_MS = 12_000;

function fetchWithConnectBudget(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String((input as Request).url || '');
  const method = String(init?.method || (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET') || 'GET');
  if (shouldBlockHotTableSupabaseWrite(url, method)) {
    const body = JSON.stringify({
      message: 'HOT_TABLE_EOD_ONLY_BLOCKED',
      details: 'Runtime writes to twilio_call_logs and agent_dial_metrics are disabled outside 11 PM EOD sync window.',
      method,
      url,
    });
    return Promise.resolve(
      new Response(body, {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), SUPABASE_ADMIN_FETCH_MS);
  const timedFetch = wrapFetchWithPerf('supabase-admin-http', fetch);
  return timedFetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(id));
}

// Server-side admin client with service role key for writes
export const supabaseAdminRaw = (supabaseServiceKey && supabaseUrl)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        fetch: fetchWithConnectBudget,
      },
    })
  : null;

// Server-side admin client with service role key for writes
export const supabaseAdmin = (supabaseServiceKey && supabaseUrl) 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        fetch: fetchWithConnectBudget,
      },
    })
  : null;

function patchLocalTableRouting(client: any): void {
  if (!client || typeof client.from !== 'function') return;
  const originalFrom = client.from.bind(client);
  client.from = (table: string) => {
    const t = String(table || '').toLowerCase();
    if (t === 'twilio_call_logs' || t === 'agent_dial_metrics') {
      return localHotTableClient.from(t);
    }
    return originalFrom(table);
  };
}

// Route local-table queries to local Postgres query builders.
patchLocalTableRouting(supabase as any);
patchLocalTableRouting(supabaseAdmin as any);
patchLocalTableRouting(supabaseAdminRaw as any);

if (supabase) {
  console.log('✅ Supabase anon client created successfully');
} else {
  console.log('❌ Supabase anon client creation failed - missing credentials');
}

if (supabaseAdmin) {
  console.log('✅ Supabase admin client created successfully');
} else {
  console.log('❌ Supabase admin client creation failed - missing credentials');
}

export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
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
}