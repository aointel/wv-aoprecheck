import type { Request } from 'express';
import { supabaseAdmin } from './supabase';

/**
 * Email for API auth: Supabase Bearer JWT first, then x-user-email, then session.
 */
export async function resolveAgentEmailFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && supabaseAdmin) {
    const token = authHeader.slice(7);
    try {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);
      if (!error && user?.email) return user.email.toLowerCase().trim();
    } catch {
      /* ignore */
    }
  }
  const h = req.headers['x-user-email'] || req.headers['user-email'];
  const hdr = typeof h === 'string' ? h : Array.isArray(h) ? h[0] : '';
  if (hdr?.includes('@')) return hdr.toLowerCase().trim();
  const sess = (req.session as { user?: { email?: string } } | undefined)?.user?.email;
  if (sess?.includes('@')) return sess.toLowerCase().trim();
  return null;
}
