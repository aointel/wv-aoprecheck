import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase, supabaseAdmin, type AuthUser, type LoginCredentials, type SignupCredentials } from './supabase';
import { storage } from './storage';
import { z } from 'zod';
import { smsService } from './sms-service';
import { usageTracker } from './usage-tracker';

const loginSchema = z.object({
  email: z.string().email().transform(email => email.toLowerCase().trim()),
  // Do not enforce minimum length at API validation; let Supabase validate credentials.
  password: z.string().min(1)
});

const signupSchema = z.object({
  email: z.string().email().transform(email => email.toLowerCase().trim()),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().default('+1-555-0000'),
  zoomId: z.string().optional(),
  zoomPassword: z.string().optional().default('1'),
  primaryMarket: z.string().optional(),
  secondaryMarket: z.string().optional(),
  /** Connect / Recruit / PreCheck — sections the agent is applying for at signup */
  aoiModules: z.array(z.string()).optional(),
  states: z.union([z.array(z.string()), z.string()]).optional(), // Licensed states
  market: z.union([z.string(), z.array(z.string())]).optional(), // Market(s) - can be string or array
  aoiRecruitOptIn: z.boolean().optional()
});

export function customerFlagsFromAoiModules(modules: string[] | undefined): {
  AOICONNECT: string;
  RECRUITACTIVE: string;
  PLUSACTIVE: string;
} {
  const m = modules ?? [];
  return {
    AOICONNECT: m.includes("connect") ? "ACTIVE" : "INACTIVE",
    RECRUITACTIVE: m.includes("recruit") ? "ACTIVE" : "INACTIVE",
    PLUSACTIVE: m.includes("precheck") ? "ACTIVE" : "INACTIVE",
  };
}

function normalizeMarketArray(value: unknown, fallback?: string): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const merged = raw.length ? raw : (fallback ? [fallback] : []);
  return [...new Set(merged.map((m) => String(m).trim()).filter(Boolean))];
}

function normalizeStateArray(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(
    raw
      .map((s) => String(s).trim().toUpperCase().replace(/^"+|"+$/g, ''))
      .filter((s) => /^[A-Z]{2}$/.test(s)),
  )];
}

function deriveSupabasePasswordFromAssociateId(associateId: string): string {
  const raw = String(associateId || '').trim();
  if (!raw) return raw;
  if (raw.length >= 6) return raw;
  return raw.padEnd(6, '0');
}

function deriveLegacyAssociatePassword(associateId: string): string {
  const raw = String(associateId || '').trim();
  if (!raw) return raw;
  if (raw.length >= 6) return raw;
  const repeated = raw.repeat(Math.ceil(6 / raw.length));
  return repeated.slice(0, 6);
}

function getAssociatePasswordCandidates(associateId: string): string[] {
  const raw = String(associateId || '').trim();
  const candidates = [
    raw,
    deriveSupabasePasswordFromAssociateId(raw),
    deriveLegacyAssociatePassword(raw),
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(timeoutValue), timeoutMs)),
  ]);
}

async function lookupAssociateIdByEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin || !email?.includes('@')) return null;
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const LOOKUP_TIMEOUT_MS = 1200;
    const byEqResult = await withTimeout(
      supabaseAdmin
        .from('customers')
        .select('associate_id')
        .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
        .maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: 'lookup_timeout_eq' } } as any,
    );
    const byEq = (byEqResult as any)?.data;
    if (byEq?.associate_id != null) return String(byEq.associate_id).trim();

    const byIlikeResult = await withTimeout(
      supabaseAdmin
        .from('customers')
        .select('associate_id')
        .or(`company_email.ilike.${normalizedEmail},personal_email.ilike.${normalizedEmail}`)
        .maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: 'lookup_timeout_ilike' } } as any,
    );
    const byIlike = (byIlikeResult as any)?.data;
    if (byIlike?.associate_id != null) return String(byIlike.associate_id).trim();

    const producerResult = await withTimeout(
      supabaseAdmin
        .from('producerlist')
        .select('associate_id')
        .ilike('company_email', normalizedEmail)
        .maybeSingle(),
      LOOKUP_TIMEOUT_MS,
      { data: null, error: { message: 'lookup_timeout_producerlist' } } as any,
    );
    const producer = (producerResult as any)?.data;
    if (producer?.associate_id != null) return String(producer.associate_id).trim();
  } catch (e) {
    console.warn('⚠️ lookupAssociateIdByEmail failed:', e);
  }
  return null;
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u: any) => String(u?.email || '').trim().toLowerCase() === normalizedEmail);
    if (match?.id) return String(match.id);
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

// Temporary storage for SMS reset codes (in production, use Redis)
const smsResetCodes = new Map<string, {
  code: string;
  email: string;
  phone: string;
  userId: string; // Store user ID so we don't have to look it up again
  expires: number;
}>();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of smsResetCodes.entries()) {
    if (value.expires < now) {
      smsResetCodes.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class AuthService {
  // Login endpoint - SUPABASE AUTHENTICATION
  static async login(req: Request, res: Response) {
    try {
      const LOGIN_AUTH_TIMEOUT_MS = 10_000;
      const credentials = loginSchema.parse(req.body);
      let passwordForAuth = credentials.password;
      let associatePasswordCandidates: string[] = [];

      // Allow agents to type raw associate ID even when it's shorter than Supabase password minimum.
      // We store a deterministic padded variant in Supabase and translate here.
      if (/^\d+$/.test(credentials.password)) {
        const associateId = await lookupAssociateIdByEmail(credentials.email);
        if (associateId && credentials.password === associateId) {
          associatePasswordCandidates = getAssociatePasswordCandidates(associateId);
          passwordForAuth = associatePasswordCandidates[0] || credentials.password;
          if (passwordForAuth !== credentials.password) {
            console.log(`🔐 Login password normalized from associate_id for ${credentials.email}`);
          }
        }
      }
      
      console.log(`🔐 Supabase login attempt for: ${credentials.email}`);
      console.log(`🔧 Supabase client available: ${!!supabase}`);
      console.log(`🔧 Using credentials - Email: ${credentials.email}, Password length: ${credentials.password.length}`);
      
      if (!supabase) {
        console.log('❌ Supabase client is null - configuration error');
        return res.status(500).json({ 
          error: 'Authentication service not available - Supabase not configured' 
        });
      }
      
      console.log('🔄 Calling supabase.auth.signInWithPassword...');
      const passwordsToTry =
        associatePasswordCandidates.length > 0 ? associatePasswordCandidates : [passwordForAuth];

      let data: any = null;
      let error: any = null;
      for (const candidatePassword of passwordsToTry) {
        const attempt = await withTimeout(
          supabase.auth.signInWithPassword({
            email: credentials.email,
            password: candidatePassword,
          }),
          LOGIN_AUTH_TIMEOUT_MS,
          {
            data: { user: null, session: null },
            error: {
              message: `Login timed out after ${LOGIN_AUTH_TIMEOUT_MS}ms`,
              status: 503,
              code: 'auth_timeout',
            },
          } as any,
        );
        data = attempt.data;
        error = attempt.error;
        if (!error && data?.user) {
          break;
        }
      }
      console.log(`🔄 Supabase response - Error: ${error?.message || 'none'}, User: ${data?.user?.email || 'none'}`);

      if (error) {
        console.log(`❌ Supabase auth error for ${credentials.email}:`, error.message);
        console.log(`❌ Full error details:`, JSON.stringify(error, null, 2));
        // Provide more specific error messages
        let errorMessage = 'Invalid email or password';
        if (error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (error.message?.includes('Email not confirmed')) {
          errorMessage = 'Email not confirmed. Please verify your email first.';
        } else if (error.message?.includes('User not found')) {
          errorMessage = 'User not found. Please contact support if you believe this is an error.';
        }
        return res.status(401).json({ 
          error: errorMessage, 
          details: error.message,
          code: error.status || error.code
        });
      }

      if (!data.user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log(`✅ Supabase login successful for ${credentials.email}`);

      // Check domain restriction - allow specific test accounts for debugging
      const allowedTestEmails = ['test@aoprecheck.com', 'chrislafond@aoglobelife.com', 'cnsysop@aoglobelife.com'];
      const isTrustedDomain = data.user.email?.endsWith('@aoglobelife.com') || allowedTestEmails.includes(data.user.email || '');

      // Check if email is verified
      // CRITICAL: Skip email verification for @aoglobelife.com users (manually created in Supabase)
      // and allowed test emails - they don't need email verification
      if (!data.user.email_confirmed_at && !isTrustedDomain) {
        console.log(`⚠️ Email not verified for ${credentials.email}`);
        return res.status(403).json({ 
          error: 'Email not verified. Please check your email for the verification code and verify your account before logging in.',
          requiresVerification: true
        });
      }
      
      // For manually created @aoglobelife.com users, auto-verify them on first login
      if (!data.user.email_confirmed_at && isTrustedDomain) {
        console.log(`✅ Auto-verifying manually created user: ${credentials.email}`);
        // Note: We can't update email_confirmed_at directly via client, but we can skip the check
        // The user is trusted since they're @aoglobelife.com
      }
      if (!data.user.email?.endsWith('@aoglobelife.com') && !allowedTestEmails.includes(data.user.email || '')) {
        console.log(`❌ Access denied for email: ${data.user.email}`);
        return res.status(403).json({ 
          error: 'Access denied. Only @aoglobelife.com accounts are allowed.' 
        });
      }

      // Get or create agent profile
      let agentProfile;
      try {
        agentProfile = await storage.getAgentProfileByEmail(data.user.email || "");
      } catch (dbError) {
        console.warn('⚠️ Database operation failed, creating mock profile:', dbError);
        // Create a mock profile when database is unavailable
        agentProfile = {
          id: 1,
          firstName: data.user.email?.split('@')[0] || 'User',
          lastName: 'Agent',
          phone: '+1-555-0000',
          email: data.user.email || '',
          zoomId: '',
          zoomPassword: '1',
          supabaseUserId: data.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      
      if (!agentProfile) {
        // Auto-create profile for @aoglobelife.com users
        const allowedTestEmails = ['test@aoprecheck.com', 'chrislafond@aoglobelife.com', 'cnsysop@aoglobelife.com'];
        if (data.user.email?.endsWith('@aoglobelife.com') || allowedTestEmails.includes(data.user.email || '')) {
          const emailPrefix = data.user.email.split('@')[0];
          const nameParts = emailPrefix.split(/[._-]/);
          const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Agent';
          const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
          
          try {
            agentProfile = await storage.createAgentProfileWithSupabaseId({
              supabaseUserId: data.user.id,
              firstName,
              lastName,
              phone: '+1-555-0000', // Default phone, can be updated later
              email: data.user.email,
              zoomId: '',
              zoomPassword: '1'
            });
            console.log(`✅ Auto-created agent profile for ${data.user.email}`);
          } catch (dbError) {
            console.warn('⚠️ Failed to create agent profile in database, using mock profile:', dbError);
            // Create mock profile if database creation fails
            agentProfile = {
              id: 1,
              firstName,
              lastName,
              phone: '+1-555-0000',
              email: data.user.email,
              zoomId: '',
              zoomPassword: '1',
              supabaseUserId: data.user.id,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }
        } else {
          console.log(`❌ Access denied for email: ${data.user.email}`);
          return res.status(403).json({ 
            error: 'Access denied. Only @aoglobelife.com accounts are allowed.' 
          });
        }
      }

      // Store user session
      (req.session as any).user = {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      };
      (req.session as any).profile = agentProfile;
      
      console.log(`✅ Login successful for ${data.user.email}, session created`);

      // Track login for weekly usage stats
      const sessionId = req.session.id || `session-${Date.now()}`;
      // Use proper IP detection that handles proxies, load balancers, and Cloudflare
      const { getRealIP } = await import('./ip-analysis-service');
      const ipAddress = getRealIP(req);
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      usageTracker.trackLogin(data.user.email || '', sessionId, ipAddress).catch(err => {
        console.error('⚠️ Failed to track login:', err);
      });

      // 🔥 CHECK FOR CONCURRENT LOGINS (same account from different IPs) - BLOCK NEW LOGIN
      try {
        const agentEmail = data.user.email || '';
        
        // Find all active sessions for this user (sessions with recent heartbeat - within last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const concurrentQuery = supabaseAdmin
          .from('agent_sessions')
          .select('session_id, last_heartbeat_at, metadata, current_status')
          .eq('agent_email', agentEmail.toLowerCase())
          .gte('last_heartbeat_at', fiveMinutesAgo)
          .in('current_status', ['active', 'idle', 'on_call', 'on_presentation', 'browsing'])
          .limit(25);

        // Keep login snappy even if Supabase is slow; fail-open quickly and track in logs.
        const CONCURRENT_CHECK_MS = 1_500;
        const { data: existingSessions, error: sessionCheckError } = await Promise.race([
          concurrentQuery,
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(
              () => resolve({ data: null, error: { message: 'concurrent_check_timeout' } }),
              CONCURRENT_CHECK_MS,
            ),
          ),
        ]).then((r) => r as { data: any; error: any });

        if (sessionCheckError?.message === 'concurrent_check_timeout') {
          console.warn(
            `⚠️ Concurrent login check timed out after ${CONCURRENT_CHECK_MS}ms for ${agentEmail} — allowing login (fail-open)`,
          );
        }

        if (!sessionCheckError && existingSessions && existingSessions.length > 0) {
          // Check if any existing session is from a different IP (block different IPs only)
          // Allow same IP multiple sessions (multiple tabs/browsers on same device)
          // FIXED: Don't block on missing/unknown IPs - only block if we have a confirmed different IP
          const differentIPSessions = existingSessions.filter(session => {
            const sessionIP = session.metadata?.ip_address;
            // Only block if we have a valid IP for both sessions AND they're different
            // Don't block on missing/unknown IPs - too aggressive and causes false blocks
            if (!sessionIP || sessionIP === 'unknown' || !ipAddress || ipAddress === 'unknown') {
              return false; // Don't block if IP is missing or unknown for either session
            }
            return sessionIP !== ipAddress;
          });

          if (differentIPSessions.length > 0) {
            // CONCURRENT LOGIN FROM DIFFERENT IP DETECTED - BLOCK THE NEW LOGIN
            console.warn(`🚨 CONCURRENT LOGIN BLOCKED for ${agentEmail}:`);
            console.warn(`   - New login attempt from IP: ${ipAddress}`);
            console.warn(`   - Existing active sessions from different IPs: ${differentIPSessions.length}`);
            differentIPSessions.forEach(session => {
              console.warn(`     * Session ${session.session_id} from IP: ${session.metadata?.ip_address}, Status: ${session.current_status}`);
            });

            // Log this security event to agent_activity_log
            await supabaseAdmin.from('agent_activity_log').insert({
              agent_email: agentEmail.toLowerCase(),
              activity_type: 'login_blocked',
              session_id: sessionId,
              page_path: '/login',
              feature: 'authentication',
              started_at: new Date().toISOString(),
              metadata: {
                security_event: 'concurrent_login_blocked',
                attempted_ip: ipAddress,
                existing_session_count: differentIPSessions.length,
                existing_session_ids: differentIPSessions.map(s => s.session_id),
                existing_ips: differentIPSessions.map(s => s.metadata?.ip_address).filter(Boolean),
                action_taken: 'login_rejected',
              },
            }).catch(err => {
              console.error('⚠️ Failed to log blocked login event:', err);
            });

            // REJECT THE LOGIN - Return error to prevent multiple sessions from different IPs
            return res.status(403).json({
              error: 'Multiple logins detected',
              message: `This account is already logged in from another location (IP: ${differentIPSessions[0]?.metadata?.ip_address}). Please log out from the other session first, or wait 5 minutes for the session to expire.`,
              details: {
                existing_sessions: differentIPSessions.length,
                existing_ips: differentIPSessions.map(s => s.metadata?.ip_address).filter(Boolean),
              }
            });
          }
        }
      } catch (concurrentCheckError) {
        console.error('⚠️ Error checking for concurrent logins:', concurrentCheckError);
        // During outages, fail-open but log security warning
        // This prevents locking out all users if Supabase is down
        console.warn('⚠️ SECURITY WARNING: Allowing login without session check due to error. This could allow concurrent logins.');
        // Continue with login - better UX than blocking everyone during outages
        // The security risk is logged and can be monitored
      }

      // Session telemetry + active_logins must not block the HTTP response (Supabase slowness was stretching logins)
      const accessToken = data.session?.access_token;
      const emailForBg = data.user.email || '';
      const supabaseIdForBg = data.user.id;
      if (supabaseAdmin) {
        void (async () => {
          try {
            const { initializeAgentSession } = await import('./agent-activity-tracker');
            await initializeAgentSession(supabaseAdmin, {
              agentEmail: emailForBg,
              sessionId,
              metadata: {
                login_method: 'password',
                supabase_user_id: supabaseIdForBg,
                ip_address: ipAddress,
                user_agent: userAgent,
                login_timestamp: new Date().toISOString(),
              },
            });
          } catch (activityError) {
            console.warn('⚠️ Failed to initialize agent session (non-critical):', activityError);
          }
          if (accessToken) {
            try {
              const decoded = jwt.decode(accessToken) as { iat?: number } | null;
              const iat = decoded?.iat;
              const agentEmail = emailForBg.toLowerCase();
              if (typeof iat === 'number' && agentEmail) {
                await supabaseAdmin
                  .from('active_logins')
                  .upsert(
                    { user_email: agentEmail, valid_jwt_iat: iat, updated_at: new Date().toISOString() },
                    { onConflict: 'user_email' },
                  );
              }
            } catch (activeLoginsErr) {
              console.warn('⚠️ Failed to store active login (non-critical):', activeLoginsErr);
            }
          }
        })();
      }

      // Set shared auth cookie for compartmentalized architecture (section servers + API validate via JWT)
      if (accessToken) {
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieDomain = process.env.AUTH_COOKIE_DOMAIN; // e.g. .aoiglobe.com for all subdomains

        const ua = req.headers['user-agent'] || '';
        const isElectron = ua.includes('AOI-Desktop') || ua.includes('Electron');
        const sameSiteValue = isElectron || isProduction ? 'none' : 'lax';

        res.cookie('sb-access-token', accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: sameSiteValue,
          maxAge: 24 * 60 * 60 * 1000,
          ...(cookieDomain ? { domain: cookieDomain } : {}),
        });
      }

      // Return user data and profile
      res.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          created_at: data.user.created_at
        },
        profile: agentProfile,
        sessionId: sessionId // Include sessionId for frontend heartbeat
      });

    } catch (error) {
      console.error('Login error:', error);
      console.error('Login error stack:', error instanceof Error ? error.stack : 'No stack trace');
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: error.errors 
        });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Signup endpoint (admin only - creates new agent accounts)
  static async signup(req: Request, res: Response) {
    try {
      const userData = signupSchema.parse(req.body);

      if (!supabaseAdmin) {
        return res.status(500).json({ 
          error: 'Admin authentication not configured' 
        });
      }

      // CRITICAL: Check if email exists in customers table before allowing signup
      const normalizedEmail = userData.email.toLowerCase().trim();
      console.log(`🔍 Checking if email exists in customers table: ${normalizedEmail}`);
      
      try {
        const { data: customer, error: customerLookupError } = await supabaseAdmin
          .from('customers')
          .select('company_email, personal_email')
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
          .maybeSingle();

        if (customerLookupError) {
          console.error('❌ Error looking up customer:', customerLookupError);
          // Continue with signup if lookup fails (don't block on database errors)
        } else if (!customer) {
          // Email not found in customers table - block signup
          console.log(`❌ Email ${normalizedEmail} not found in customers table - signup blocked`);
          return res.status(404).json({
            error: 'Email not found',
            message: 'Your email address was not found in our system. Please contact aointel@aoglobelife.com for signup assistance.',
            requiresAssistance: true,
            assistanceEmail: 'aointel@aoglobelife.com'
          });
        } else {
          console.log(`✅ Email ${normalizedEmail} found in customers table - signup allowed`);
        }
      } catch (lookupError) {
        console.error('❌ Error during customer lookup:', lookupError);
        // Continue with signup if lookup fails (don't block on errors)
      }

      // Create user in Supabase auth (email NOT confirmed yet - requires verification)
      console.log(`🔐 Creating Supabase user: ${userData.email}`);
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: false, // Require email verification before login
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          primary_market: userData.primaryMarket ?? "",
          secondary_market: userData.secondaryMarket ?? "",
          aoi_modules: userData.aoiModules ?? [],
        },
      });

      if (error) {
        console.error('❌ Supabase error:', JSON.stringify(error, null, 2));
        return res.status(400).json({ 
          error: 'Failed to create user account', 
          details: error.message 
        });
      }

      if (!data.user) {
        return res.status(400).json({ error: 'Failed to create user account' });
      }

      console.log(`✅ User account created: ${userData.email}`);

      // Send verification email
      try {
        const { emailVerificationService } = await import('./email-verification-service');
        const verificationResult = await emailVerificationService.sendVerificationEmail(
          userData.email,
          userData.firstName
        );
        
        if (verificationResult.success) {
          console.log(`✅ Verification email sent to ${userData.email}`);
        } else {
          console.error(`❌ Failed to send verification email: ${verificationResult.error}`);
        }
      } catch (emailError) {
        console.error('❌ Error sending verification email:', emailError);
        // Don't fail signup if email fails - user can request resend
      }

      // Create agent profile in Supabase
      const profileData = {
        supabase_user_id: data.user.id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || '+1-555-0000',
        email: userData.email,
        zoom_id: userData.zoomId || '',
        zoom_password: userData.zoomPassword || '1',
        primary_market: userData.primaryMarket || '',
        secondary_market: userData.secondaryMarket || '',
        created_at: new Date().toISOString()
      };

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('agent_profiles')
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        console.error('❌ Failed to create agent profile:', profileError);
        // User was created but profile failed - not ideal but user can still login
      }

      // CRITICAL: Also create record in customers table
      console.log(`📝 Creating customer record for ${userData.email}...`);
      
      // Prepare market field - can be string or array
      const marketField = normalizeMarketArray(userData.market, userData.primaryMarket);
      const statesField = normalizeStateArray(userData.states);
      
      // Lookup MGA/RGA team from agent_hierarchy if email exists there
      let mgaTeam = null;
      let rgaTeam = null;
      try {
        const { data: hierarchyData } = await supabaseAdmin
          .from('agent_hierarchy')
          .select('mga_name, rga_name, agent_associate_id')
          .eq('agent_email', userData.email)
          .maybeSingle();
        
        if (hierarchyData) {
          mgaTeam = hierarchyData.mga_name;
          rgaTeam = hierarchyData.rga_name;
          console.log(`✅ Found MGA/RGA team from hierarchy for ${userData.email}: MGA=${mgaTeam}, RGA=${rgaTeam}`);
        } else {
          console.log(`⚠️ No agent_hierarchy entry found for ${userData.email} - MGA team will be NULL`);
        }
      } catch (error) {
        console.error('❌ Error looking up MGA/RGA team:', error);
      }
      
      const moduleFlags = customerFlagsFromAoiModules(userData.aoiModules);
      const customerData = {
        company_email: userData.email,
        personal_email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || '+1-555-0000',
        agent_name: `${userData.firstName} ${userData.lastName}`,
        VDPACTIVE: 'INACTIVE',
        PLUSACTIVE: moduleFlags.PLUSACTIVE,
        RECRUITACTIVE: moduleFlags.RECRUITACTIVE,
        AOICONNECT: moduleFlags.AOICONNECT,
        CCPRO: false,
        primary_market: userData.primaryMarket || '',
        secondary_market: userData.secondaryMarket || '',
        market: marketField, // Array of markets
        states: statesField, // Array of licensed states
        mga_team: mgaTeam, // MGA team from agent_hierarchy
        rga_team: rgaTeam, // RGA team from agent_hierarchy
        created_at: new Date().toISOString()
      };
      
      console.log(`📊 Customer data for ${userData.email}:`, {
        market: customerData.market,
        states: customerData.states,
        primary_market: customerData.primary_market,
        mga_team: customerData.mga_team,
        rga_team: customerData.rga_team
      });

      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (customerError) {
        console.error('❌ Failed to create customer record:', customerError);
      } else {
        console.log(`✅ Customer record created for ${userData.email}`);
      }

      // Also create initial credit record
      console.log(`💳 Creating initial credit record for ${userData.email}...`);
      const creditData = {
        email: userData.email,
        credits_remaining: 0, // Start with 0 credits
        credits_used: 0,
        last_updated: new Date().toISOString()
      };

      const { error: creditError } = await supabaseAdmin
        .from('user_credits')
        .insert(creditData);

      if (creditError) {
        console.error('❌ Failed to create credit record:', creditError);
      } else {
        console.log(`✅ Credit record created for ${userData.email}`);
      }

      res.json({
        success: true,
        message: 'Agent account created successfully',
        user: {
          id: data.user.id,
          email: data.user.email
        },
        profile: profile || profileData,
        customer: customer || customerData
      });

    } catch (error) {
      console.error('Signup error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input', 
          details: error.errors 
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Logout endpoint
  static async logout(req: Request, res: Response) {
    try {
      const sessionUser = (req.session as any).user;
      const sessionId = req.session.id || 'unknown';
      
      // 🔥 NEW: Mark session as ended (but keep tracking - they might still be "logged in" browser-side)
      if (sessionUser?.email) {
        try {
          const { updateAgentStatus } = await import('./agent-activity-tracker');
          await updateAgentStatus(supabaseAdmin, {
            agentEmail: sessionUser.email,
            sessionId: sessionId,
            status: 'away',
            metadata: {
              logout_method: 'manual',
            },
          });
        } catch (activityError) {
          console.warn('⚠️ Failed to update agent status on logout (non-critical):', activityError);
        }
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get current user profile
  static async getProfile(req: Request, res: Response) {
    try {
      const sessionUser = (req.session as any).user;
      const sessionProfile = (req.session as any).profile;
      
      if (!sessionUser) {
        
        // Check for Authorization header with Supabase access token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ') && supabase) {
          const accessToken = authHeader.substring(7);
          
          try {
            // Verify token with Supabase
            const { data: { user }, error } = await supabase.auth.getUser(accessToken);
            
            if (error || !user) {
              return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // Check domain restriction
            if (!user.email?.endsWith('@aoglobelife.com') && user.email !== 'test@aoprecheck.com') {
              return res.status(403).json({ 
                error: 'Access denied. Only @aoglobelife.com accounts are allowed.' 
              });
            }

            // Get or create agent profile
            let agentProfile = await storage.getAgentProfileByEmail(user.email || "");
            
            if (!agentProfile) {
              // Auto-create profile for @aoglobelife.com users
              if (user.email?.endsWith('@aoglobelife.com')) {
                const emailPrefix = user.email.split('@')[0];
                const nameParts = emailPrefix.split(/[._-]/);
                const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Agent';
                const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'User';
                
                agentProfile = await storage.createAgentProfileWithSupabaseId({
                  supabaseUserId: user.id,
                  firstName,
                  lastName,
                  phone: '+1-555-0000',
                  email: user.email,
                  zoomId: '',
                  zoomPassword: '1'
                });
                
                console.log(`✅ Auto-created agent profile for ${user.email}`);
              } else {
                return res.status(403).json({ 
                  error: 'Access denied. Only @aoglobelife.com accounts are allowed.' 
                });
              }
            }

            const authUser = {
              id: user.id,
              email: user.email!,
              created_at: user.created_at
            };

            // Resolve associate_id synchronously to ensure session is fully populated
            let profileWithAssociateId = { ...agentProfile };
            if (supabaseAdmin && user.email && !(agentProfile as any).associate_id) {
              try {
                const email = user.email.toLowerCase().trim();
                const { data: customer } = await supabaseAdmin
                  .from('customers')
                  .select('associate_id')
                  .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
                  .limit(1)
                  .maybeSingle();
                
                if (customer?.associate_id != null) {
                  (profileWithAssociateId as any).associate_id = customer.associate_id;
                }
              } catch (error) {
                // Ignore errors - associate_id is optional
              }
            }

            // Store in session
            (req.session as any).user = authUser;
            (req.session as any).profile = profileWithAssociateId;

            return res.json({
              user: authUser,
              profile: profileWithAssociateId
            });
            
          } catch (error) {
            console.error('Token verification error:', error);
            return res.status(401).json({ error: 'Invalid token' });
          }
        }
        
        return res.status(401).json({ error: 'No active session' });
      }

      // If user exists but profile is missing, try to fetch it
      let finalProfile = sessionProfile;
      if (!finalProfile && sessionUser?.id) {
        try {
          finalProfile = await storage.getAgentProfileByEmail(sessionUser.email || "");
          if (finalProfile) {
            // Cache in session for next request
            (req.session as any).profile = finalProfile;
          }
        } catch (error) {
          console.log('Could not fetch profile:', error);
        }
      }

      // Resolve associate_id synchronously if missing
      let profileWithAssociateId = finalProfile;
      if (finalProfile && !(finalProfile as any).associate_id && supabaseAdmin && sessionUser?.email) {
        try {
          const email = sessionUser.email.toLowerCase().trim();
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('associate_id')
            .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
            .limit(1)
            .maybeSingle();
          
          if (customer?.associate_id != null) {
            profileWithAssociateId = { ...finalProfile, associate_id: customer.associate_id };
            (req.session as any).profile = profileWithAssociateId;
          }
        } catch (error) {
          // Ignore errors - associate_id is optional
        }
      }

      res.json({
        user: sessionUser,
        profile: profileWithAssociateId
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update agent profile
  static async updateProfile(req: Request, res: Response) {
    try {
      const sessionUser = (req.session as any).user;
      
      if (!sessionUser) {
        return res.status(401).json({ error: 'No active session' });
      }

      const updateData = req.body;
      const updatedProfile = await storage.updateAgentProfileBySupabaseId(sessionUser.id, updateData);

      if (!updatedProfile) {
        return res.status(404).json({ error: 'Agent profile not found' });
      }

      // Update session profile
      (req.session as any).profile = updatedProfile;

      res.json({
        success: true,
        profile: updatedProfile
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Forgot password - send SMS code (EMAIL + PHONE - NO PRODUCERLIST)
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Admin authentication not configured' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 1. Look up customer details
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('associate_id, phone, agent_name, first_name')
        .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
        .maybeSingle();

      const associateId = customer?.associate_id != null
        ? String(customer.associate_id)
        : await lookupAssociateIdByEmail(normalizedEmail);
      if (!associateId) {
        // Return success anyway to prevent email enumeration
        return res.json({ success: true, message: 'If your account exists, your passcode has been sent.' });
      }

      const passcode = deriveSupabasePasswordFromAssociateId(associateId);

      // 2. Reset Supabase password to associate_id-derived passcode.
      // Do NOT silently continue if this fails; users must only be told a passcode that is actually valid.
      let passcodeSet = false;
      try {
        const authUserId = await findAuthUserIdByEmail(normalizedEmail);
        if (authUserId) {
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: passcode });
          if (updateErr) {
            throw updateErr;
          }
          passcodeSet = true;
          console.log(`✅ forgotPassword: Updated existing auth password for ${normalizedEmail}`);
        } else {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: passcode,
            email_confirm: true,
          });
          if (createErr) {
            throw createErr;
          }
          if (created?.user?.id) {
            passcodeSet = true;
            console.log(`✅ forgotPassword: Created missing auth user with passcode for ${normalizedEmail}`);
          }
        }
      } catch (resetErr) {
        console.error('❌ forgotPassword: Failed to set Supabase passcode:', resetErr);
        return res.status(500).json({
          success: false,
          error: 'Unable to set passcode right now. Please try again in a moment.',
        });
      }

      if (!passcodeSet) {
        console.error(`❌ forgotPassword: passcodeSet=false for ${normalizedEmail}`);
        return res.status(500).json({
          success: false,
          error: 'Unable to set passcode right now. Please try again in a moment.',
        });
      }

      // 3. Return passcode directly in response (no SMS delivery)
      return res.json({
        success: true,
        message: 'Your passcode is shown below.',
        associateId: passcode,
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async resetPasswordWithSMS(req: Request, res: Response) {
    try {
      const { email, phone, code, newPassword } = req.body;

      if (!email || !phone || !code || !newPassword) {
        return res.status(400).json({ 
          error: 'Email, phone number, verification code, and new password are required' 
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters long' 
        });
      }

      // Normalize inputs
      const normalizedEmail = email.trim().toLowerCase();
      const cleanPhone = phone.replace(/D/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone.startsWith('+') ? cleanPhone : `+1${cleanPhone}`;

      console.log(`🔄 Verifying SMS code for password reset: ${normalizedEmail}, phone: ${formattedPhone}`);

      // Find matching code by email AND phone
      let foundEntry = null;
      let foundKey = null;
      
      for (const [key, value] of smsResetCodes.entries()) {
        // Match by email AND phone (normalize both for comparison)
        const storedEmail = value.email?.toLowerCase().trim();
        const storedPhoneClean = value.phone.replace(/D/g, '');
        const requestPhoneClean = formattedPhone.replace(/D/g, '');
        
        if (storedEmail === normalizedEmail && 
            storedPhoneClean === requestPhoneClean && 
            value.code === code && 
            value.expires > Date.now()) {
          foundEntry = value;
          foundKey = key;
          break;
        }
      }

      if (!foundEntry) {
        return res.status(400).json({ 
          error: 'Invalid or expired verification code' 
        });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ 
          error: 'Admin authentication not configured' 
        });
      }

      console.log(`🔄 Updating password via Supabase admin for: ${normalizedEmail}`);

      // Use the user ID we stored when the code was created - no need to look up again!
      const userId = foundEntry.userId;
      
      if (!userId) {
        console.error(`❌ No user ID stored in reset code for: ${normalizedEmail}`);
        return res.status(500).json({ 
          error: 'Invalid reset code. Please request a new code.' 
        });
      }

      console.log(`✅ Using stored user ID: ${userId} for password reset`);

      // Update password in Supabase Auth using the stored user ID
      // Include email_confirm to ensure the user can login immediately
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { 
          password: newPassword,
          email_confirm: true // Ensure email is confirmed so user can login
        }
      );

      if (updateError) {
        console.error('❌ Password update error:', updateError);
        console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
        return res.status(400).json({ 
          error: 'Failed to update password', 
          details: updateError.message 
        });
      }

      if (!updateData || !updateData.user) {
        console.error('❌ Password update returned no user data');
        return res.status(500).json({ 
          error: 'Password update failed - no user data returned' 
        });
      }

      console.log(`✅ Password updated successfully via SMS reset for: ${normalizedEmail}`);
      console.log(`✅ Updated user ID: ${updateData.user.id}, Email: ${updateData.user.email}`);

      // Clean up used code
      if (foundKey) {
        smsResetCodes.delete(foundKey);
      }

      res.json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error('SMS password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Reset password with token
  static async resetPasswordWithToken(req: Request, res: Response) {
    try {
      const { accessToken, refreshToken, newPassword } = req.body;

      if (!accessToken || !refreshToken || !newPassword) {
        return res.status(400).json({ 
          error: 'Access token, refresh token, and new password are required' 
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters long' 
        });
      }

      if (!supabase) {
        return res.status(500).json({ 
          error: 'Authentication service not available' 
        });
      }

      console.log('🔄 Setting session with tokens for password reset...');

      // Set the session with the tokens from the email link
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (sessionError || !sessionData.user) {
        console.error('Session error:', sessionError);
        return res.status(400).json({ 
          error: 'Invalid or expired reset link', 
          details: sessionError?.message 
        });
      }

      console.log(`🔄 Updating password for user: ${sessionData.user.email}`);

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        return res.status(400).json({ 
          error: 'Failed to update password', 
          details: updateError.message 
        });
      }

      console.log(`✅ Password updated successfully for: ${sessionData.user.email}`);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (error) {
      console.error('Reset password with token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Password reset
  static async resetPassword(req: Request, res: Response) {
    try {
      const sessionUser = (req.session as any).user;
      
      if (!sessionUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ 
          error: 'Admin authentication not configured' 
        });
      }

      // Reset password in Supabase
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        email, // This should be the user ID, but we'll find it first
        { password: newPassword }
      );

      if (error) {
        // If the above fails, try finding user by email first
        console.log('Trying to find user by email:', email);
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError || !users) {
          return res.status(400).json({ 
            error: 'Failed to find user', 
            details: listError?.message 
          });
        }

        const user = users.users.find(u => u.email === email);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Now reset with the correct user ID
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        );

        if (resetError) {
          return res.status(400).json({ 
            error: 'Failed to reset password', 
            details: resetError.message 
          });
        }

        console.log(`✅ Password reset successful for ${email}`);
        return res.json({
          success: true,
          message: `Password reset successful for ${email}`
        });
      }

      console.log(`✅ Password reset successful for ${email}`);
      res.json({
        success: true,
        message: `Password reset successful for ${email}`
      });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
