/**
 * Server API keys & URLs — **edit this file only.** No env var fallbacks.
 */

// ── Supabase (project ycztjetxwpfgtrzeyytt) ──
export const SUPABASE_PROJECT_REF = "ycztjetxwpfgtrzeyytt";

export const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

/** PostgREST anon / publishable — apikey + Bearer */
export const SUPABASE_ANON_KEY =
  "sb_publishable_jYoJoWMvq9XK-USvmRuLww_OZnZkvKs";

/** Service role — paste here if you need bypass RLS / admin REST */
export const SUPABASE_SERVICE_KEY = "sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd";

// ── OpenAI ──
export const OPENAI_API_KEY = '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';

// ── Taalk (API host) ──
export const TAALK_API_BASE_URL = "https://api.taalk.ai";

/** Bearer JWT for Taalk API */
export const TAALK_API_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay5hZWQ1MDJlMi0wY2YxLTQ3NGQtYjQ2My0wNzczYzJiNWRhNDgiLCJuYW1lIjoiQU8yVGFhbGtMZWFkQVBJIiwiZXhwIjoyMDgyNzc0NDEzfQ.Mzq--wKhEjvegwmK9pFydl7SXclJOIODU0uEdEhMRyQ";

/** VDP `db` query param (RTS) */
export const TAALK_VDP_DB = "michaelmandella";
