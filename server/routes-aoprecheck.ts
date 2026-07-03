/**
 * routes-aoprecheck.ts — AO Precheck service: onboarding shell, auth, team panel.
 *
 * Auth wired into Connect Now (/api/auth/login via register-auth-routes.ts).
 * Signup provisions real Connect Now accounts (Supabase + customers + agent_profiles + user_credits).
 * UI: ao-precheck-onboarding.html (sign-in/sign-up) + ao-precheck-app.html (team slide-out + verification iframe).
 */
import type { Express, Request, Response } from "express";
import express from "express";
import path from "path";
import twilio from "twilio";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";
import { leaseDialerPool as teamPool } from "./db";
import { sendEmail } from "./email";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from "./hardcoded-config";

export const AOPRECHECK_BUILD_ID = "aoprecheck-2026-06-30-mgr-modal";

const AOPRECHECK_PUBLIC_DIR = path.resolve(process.cwd(), "dist", "public");
const APP_BASE = process.env.APP_URL || "https://aoprecheck-production.up.railway.app";
const DOMAIN_RE = /^[a-z]+@aoglobelife\.com$/;

const resetTokens = new Map<string, { email: string; expires: number }>();
const otpStore = new Map<string, { code: string; phone: string; expires: number }>();

function makeResetToken(email: string): string {
  const token = (randomUUID() + randomUUID()).replace(/-/g, "");
  resetTokens.set(token, { email: normEmail(email), expires: Date.now() + 30 * 60 * 1000 });
  return token;
}
function checkResetToken(token: string, email: string): boolean {
  const rec = resetTokens.get(token);
  if (!rec) return false;
  if (Date.now() > rec.expires) { resetTokens.delete(token); return false; }
  return rec.email === normEmail(email);
}
function genCode(): string { return String(Math.floor(100000 + Math.random() * 900000)); }
function okDomain(e = ""): boolean { return DOMAIN_RE.test(normEmail(e)); }
function normEmail(e = ""): string { return String(e).toLowerCase().trim(); }
function splitName(full: string): { first: string; last: string } {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}
function normalizePhoneE164(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (String(raw).trim().startsWith("+")) return `+${d}`;
  return `+${d}`;
}
function reqEmail(req: Request, fallback?: string): string {
  return normEmail(
    (req.body && (req.body.email || req.body.userEmail)) ||
      (req.query && (req.query.email as string)) ||
      (req.headers["x-user-email"] as string) ||
      (req.headers["user-email"] as string) ||
      fallback ||
      "",
  );
}
function managerEmailOf(req: Request): string {
  return normEmail(
    (req.body && req.body.managerEmail) ||
      (req.query && (req.query.managerEmail as string)) ||
      (req.headers["x-user-email"] as string) ||
      (req.headers["user-email"] as string) ||
      "",
  );
}
function db() {
  if (!supabaseAdmin) throw new Error("supabase_unavailable");
  return supabaseAdmin;
}
let _twilio: ReturnType<typeof twilio> | null = null;
function twilioClient(): ReturnType<typeof twilio> {
  if (!_twilio) _twilio = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return _twilio;
}
async function sendOtp(email: string, phone: string): Promise<void> {
  const code = genCode();
  otpStore.set(email, { code, phone, expires: Date.now() + 10 * 60 * 1000 });
  await twilioClient().messages.create({
    from: TWILIO_PHONE_NUMBER,
    to: phone,
    body: `Your AO Precheck verification code is ${code}`,
  });
}
function checkOtp(email: string, code: string): boolean {
  const e = otpStore.get(email);
  if (!e) return false;
  if (Date.now() > e.expires) { otpStore.delete(email); return false; }
  const match = e.code === String(code || "").trim();
  if (match) otpStore.delete(email);
  return match;
}

let _teamTablesReady: Promise<void> | null = null;
function ensureAoPrecheckTeamTables(): Promise<void> {
  if (_teamTablesReady) return _teamTablesReady;
  _teamTablesReady = (async () => {
    try {
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_teams (id text primary key, name text, manager_email text, created_at timestamptz default now())`);
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_team_members (team_id text, email text, added_at timestamptz default now(), primary key (team_id, email))`);
      await teamPool.query(`CREATE TABLE IF NOT EXISTS aoprecheck_team_invites (id text primary key, email text, invited_by text, created_at timestamptz default now())`);
      await teamPool.query(`CREATE INDEX IF NOT EXISTS aoprecheck_teams_mgr_idx ON aoprecheck_teams (lower(manager_email))`);
      for (const tbl of ["aoprecheck_team_members", "aoprecheck_team_invites"]) {
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'pending'`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_token text`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirm_sent_at timestamptz`);
        await teamPool.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS confirmed_at timestamptz`);
      }
      await teamPool.query(`ALTER TABLE aoprecheck_team_invites ADD COLUMN IF NOT EXISTS team_id text`);
      await teamPool.query(`UPDATE aoprecheck_team_members SET membership_status='confirmed' WHERE membership_status IS NULL`);
      await teamPool.query(`UPDATE aoprecheck_team_invites SET membership_status='confirmed' WHERE membership_status IS NULL`);
    } catch (e: any) {
      console.error("[aoprecheck] ensureAoPrecheckTeamTables failed (non-fatal):", e?.message || e);
    }
  })();
  return _teamTablesReady;
}

function makeConfirmToken(): string {
  return randomUUID();
}

async function sendTeamConfirmEmail(email: string, managerEmail: string, token: string): Promise<boolean> {
  const link = `${APP_BASE}/team/confirm?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #eaecf2;border-radius:14px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:22px 28px"><h1 style="margin:0;font-size:20px">AO Precheck</h1></div>
      <div style="padding:28px">
        <h2 style="margin:0 0 10px;color:#0f1729;font-size:18px">Confirm your team invitation</h2>
        <p style="color:#475067;font-size:14px"><b>${managerEmail}</b> invited you to join their team on <b>AO Precheck</b>. Click below to confirm your membership.</p>
        <p style="margin:22px 0"><a href="${link}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Confirm team membership</a></p>
      </div>
    </div>`;
  return !!(await sendEmail({
    to: email,
    subject: "Confirm your AO Precheck team invitation",
    text: `${managerEmail} invited you to join their AO Precheck team. Confirm here: ${link}`,
    html,
  }));
}

async function ensureManagerTeamId(manager: string, teamIdHint = ""): Promise<string> {
  let teamId = String(teamIdHint || "");
  if (teamId) return teamId;
  const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [manager]);
  if (tr.rows[0]?.id) return String(tr.rows[0].id);
  teamId = randomUUID();
  await teamPool.query(`INSERT INTO aoprecheck_teams(id,name,manager_email) VALUES ($1,$2,$3)`, [teamId, `${manager}'s team`, manager]);
  return teamId;
}

async function applyConfirmedInvitesForEmail(email: string): Promise<void> {
  await ensureAoPrecheckTeamTables();
  const inv = await teamPool.query(
    `SELECT team_id FROM aoprecheck_team_invites WHERE lower(email)=lower($1) AND membership_status='confirmed' AND team_id IS NOT NULL`,
    [email],
  );
  for (const row of inv.rows || []) {
    await teamPool.query(
      `INSERT INTO aoprecheck_team_members(team_id,email,membership_status,confirmed_at) VALUES ($1,$2,'confirmed',now())
       ON CONFLICT (team_id,email) DO UPDATE SET membership_status='confirmed', confirmed_at=COALESCE(aoprecheck_team_members.confirmed_at, now())`,
      [row.team_id, email],
    );
  }
}

async function confirmTeamMembershipByToken(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: "token required" };
  await ensureAoPrecheckTeamTables();
  const mr = await teamPool.query(
    `SELECT team_id, email FROM aoprecheck_team_members WHERE confirm_token=$1 LIMIT 1`,
    [token],
  );
  if (mr.rows[0]) {
    await teamPool.query(
      `UPDATE aoprecheck_team_members SET membership_status='confirmed', confirmed_at=now(), confirm_token=NULL WHERE confirm_token=$1`,
      [token],
    );
    return { ok: true };
  }
  const ir = await teamPool.query(
    `SELECT id, email, team_id FROM aoprecheck_team_invites WHERE confirm_token=$1 LIMIT 1`,
    [token],
  );
  if (ir.rows[0]) {
    await teamPool.query(
      `UPDATE aoprecheck_team_invites SET membership_status='confirmed', confirmed_at=now(), confirm_token=NULL WHERE confirm_token=$1`,
      [token],
    );
    const em = normEmail(ir.rows[0].email);
    const teamId = ir.rows[0].team_id;
    if (teamId && em) {
      const { data: cust } = await db()
        .from("customers")
        .select("company_email,personal_email")
        .or(`company_email.ilike.${em},personal_email.ilike.${em}`)
        .limit(1)
        .maybeSingle();
      if (cust) {
        await teamPool.query(
          `INSERT INTO aoprecheck_team_members(team_id,email,membership_status,confirmed_at) VALUES ($1,$2,'confirmed',now())
           ON CONFLICT (team_id,email) DO UPDATE SET membership_status='confirmed', confirmed_at=COALESCE(aoprecheck_team_members.confirmed_at, now())`,
          [teamId, em],
        );
      }
    }
    return { ok: true };
  }
  return { ok: false, error: "invalid or expired token" };
}

async function findAuthUserId(email: string): Promise<string | null> {
  const normalized = normEmail(email);
  for (let page = 1; page <= 40; page++) {
    const { data } = await db().auth.admin.listUsers({ page, perPage: 200 });
    const u = data?.users?.find((x: any) => String(x.email || "").toLowerCase() === normalized);
    if (u) return u.id;
    if (!data?.users || data.users.length < 200) break;
  }
  return null;
}
async function ensureAuthUser(email: string, password: string): Promise<string> {
  const normalized = normEmail(email);
  const existing = await findAuthUserId(normalized);
  if (existing) {
    await db().auth.admin.updateUserById(existing, { password, email_confirm: true });
    return existing;
  }
  const { data, error } = await db().auth.admin.createUser({ email: normalized, password, email_confirm: true });
  if (error) throw new Error(error.message);
  if (!data.user?.id) throw new Error("createUser: no user id");
  return data.user.id;
}
async function associateIdTaken(id: number): Promise<boolean> {
  const { data: c } = await db().from("customers").select("id").eq("associate_id", id).limit(1).maybeSingle();
  if (c) return true;
  const { data: p } = await db().from("producerlist").select("id").eq("associate_id", id).limit(1).maybeSingle();
  return !!p;
}
async function ensureAssociateId(email: string): Promise<string> {
  const normalized = normEmail(email);
  const { data: existing } = await db()
    .from("customers")
    .select("associate_id")
    .or(`company_email.ilike.${normalized},personal_email.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();
  if (existing?.associate_id) return String(existing.associate_id);
  try {
    const { data: uc } = await db().from("user_credits").select("associate_id").eq("email", normalized).maybeSingle();
    if (uc?.associate_id) return String(uc.associate_id);
  } catch { /* optional */ }
  for (let i = 0; i < 80; i++) {
    const id = 100000 + Math.floor(Math.random() * 900000);
    if (!(await associateIdTaken(id))) return String(id);
  }
  throw new Error("could not allocate associate_id");
}
async function ensureCustomer(email: string, first: string, last: string, associateId: string): Promise<void> {
  const normalized = normEmail(email);
  const agentName = `${first} ${last}`.trim();
  const row: Record<string, unknown> = {
    company_email: normalized,
    personal_email: normalized,
    first_name: first,
    last_name: last,
    agent_name: agentName,
    associate_id: Number(associateId),
    market: ["precheck"],
    states: [] as string[],
    VDPACTIVE: "INACTIVE",
    PLUSACTIVE: "INACTIVE",
    RECRUITACTIVE: "INACTIVE",
    AOICONNECT: "ACTIVE",
    CCPRO: false,
  };
  const { data: existing } = await db()
    .from("customers")
    .select("id")
    .or(`company_email.ilike.${normalized},personal_email.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();
  if (existing?.id) await db().from("customers").update(row).eq("id", existing.id);
  else await db().from("customers").insert({ ...row, created_at: new Date().toISOString() });
}
async function ensureAgentProfile(supabaseUserId: string, email: string, first: string, last: string): Promise<void> {
  const normalized = normEmail(email);
  const base: Record<string, unknown> = {
    supabase_user_id: supabaseUserId,
    email: normalized,
    first_name: first,
    last_name: last,
    authorized_markets: ["precheck"],
    license_states: [] as string[],
  };
  const { data: existing } = await db().from("agent_profiles").select("id").ilike("email", normalized).maybeSingle();
  if (existing?.id) await db().from("agent_profiles").update(base).eq("id", existing.id);
  else await db().from("agent_profiles").insert({ ...base, created_at: new Date().toISOString() });
}
async function ensureUserCredits(email: string, associateId: string, name: string): Promise<void> {
  const normalized = normEmail(email);
  const { data: ex } = await db().from("user_credits").select("email").eq("email", normalized).maybeSingle();
  if (ex) await db().from("user_credits").update({ associate_id: Number(associateId), name }).eq("email", normalized);
  else {
    await db().from("user_credits").insert({
      email: normalized,
      associate_id: Number(associateId),
      name,
      credits_remaining: 0,
      credits_used: 0,
      last_updated: new Date().toISOString(),
    });
  }
}

function hasSessionUser(req: Request): boolean {
  const session = req.session as { user?: { email?: string } } | undefined;
  return !!normEmail(session?.user?.email || "");
}

export function registerAoPrecheckRoutes(app: Express): void {
  const section = String(process.env.SECTION || "").toLowerCase();
  if (section && section !== "precheck") return;

  void ensureAoPrecheckTeamTables();

  const sendApp = (_req: Request, res: Response) =>
    res.sendFile(path.join(AOPRECHECK_PUBLIC_DIR, "ao-precheck-app.html"));
  const sendOnboarding = (_req: Request, res: Response) =>
    res.sendFile(path.join(AOPRECHECK_PUBLIC_DIR, "ao-precheck-onboarding.html"));

  const sendLanding = (req: Request, res: Response) => {
    if (hasSessionUser(req)) return res.redirect(302, "/app");
    return sendOnboarding(req, res);
  };

  app.get(["/", "/precheck", "/verify"], sendLanding);
  app.get(["/app", "/home", "/console", "/precheck-app", "/ao-precheck"], sendApp);
  app.get(["/join", "/signup", "/start", "/onboarding", "/login", "/signin", "/reset", "/forgot"], sendOnboarding);
  app.get("/team/confirm", (req: Request, res: Response) => {
    const token = String(req.query.token || "");
    if (!token) return res.redirect(302, "/app");
    res.redirect(302, `/api/team/confirm?token=${encodeURIComponent(token)}`);
  });

  app.get("/api/aoprecheck/health", (_req, res) => {
    res.json({ ok: true, service: "aoprecheck", section: "precheck", build: AOPRECHECK_BUILD_ID });
  });

  /* AUTH — same Connect Now pattern as AO Recruit */
  app.get("/api/users/lookup", async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.query.email as string);
      if (!email || !email.includes("@")) return res.json({ exists: false });
      const { data: cust } = await db()
        .from("customers")
        .select("company_email,personal_email,first_name,last_name,agent_name,associate_id")
        .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
        .limit(1)
        .maybeSingle();
      if (cust) {
        const name = String(cust.agent_name || [cust.first_name, cust.last_name].filter(Boolean).join(" ")).trim();
        return res.json({ exists: true, name: name || undefined, associate_id: cust.associate_id, email });
      }
      const { data: prof } = await db()
        .from("agent_profiles")
        .select("email,first_name,last_name")
        .ilike("email", email)
        .maybeSingle();
      if (prof) {
        const name = [prof.first_name, prof.last_name].filter(Boolean).join(" ").trim();
        return res.json({ exists: true, name: name || undefined, email });
      }
      return res.json({ exists: false });
    } catch (e: any) {
      return res.json({ exists: false, error: e?.message });
    }
  });

  app.get("/api/team/search", async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || "").trim();
      if (q.length < 2) return res.json({ results: [] });
      const like = `%${q}%`;
      const { data } = await db()
        .from("customers")
        .select("company_email,personal_email,first_name,last_name,agent_name,associate_id")
        .or(
          `company_email.ilike.${like},personal_email.ilike.${like},agent_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`,
        )
        .limit(10);
      const seen = new Set<string>();
      const results = (data || [])
        .map((c: any) => ({
          name: String(c.agent_name || [c.first_name, c.last_name].filter(Boolean).join(" ")).trim() || c.company_email || c.personal_email,
          email: normEmail(c.company_email || c.personal_email || ""),
          associate_id: c.associate_id,
        }))
        .filter((r: any) => {
          if (!r.email || seen.has(r.email)) return false;
          seen.add(r.email);
          return true;
        });
      return res.json({ results });
    } catch (e: any) {
      return res.json({ results: [], error: e?.message });
    }
  });

  app.post("/api/auth/signup", express.json(), async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.body?.email);
      const name = String(req.body?.name || "").trim();
      const password = String(req.body?.password || "");
      if (!okDomain(email)) return res.status(400).json({ error: "must use @aoglobelife.com" });
      if (!name) return res.status(400).json({ error: "name required" });
      if (password.length < 8) return res.status(400).json({ error: "password too short" });
      const { first, last } = splitName(name);
      const supabaseUserId = await ensureAuthUser(email, password);
      const associateId = await ensureAssociateId(email);
      await ensureCustomer(email, first, last, associateId);
      await ensureAgentProfile(supabaseUserId, email, first, last);
      await ensureUserCredits(email, associateId, name);
      await applyConfirmedInvitesForEmail(email);
      return res.json({ ok: true, next: "sms", associate_id: associateId });
    } catch (e: any) {
      const msg = e?.message || "signup_failed";
      const code = /already|exists|registered/i.test(msg) ? 409 : 500;
      return res.status(code).json({ error: msg });
    }
  });

  app.post("/api/auth/sms/send", express.json(), async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.body?.email);
      const phone = normalizePhoneE164(String(req.body?.phone || ""));
      if (!phone || phone.replace(/\D/g, "").length < 11) return res.status(400).json({ error: "valid mobile number required" });
      await sendOtp(email || phone, phone);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "sms_send_failed" });
    }
  });

  app.post("/api/auth/sms/verify", express.json(), async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.body?.email);
      const phone = normalizePhoneE164(String(req.body?.phone || ""));
      const code = String(req.body?.code || "").trim();
      const key = email || phone;
      if (!checkOtp(key, code)) return res.status(400).json({ error: "bad or expired code" });
      await db().from("agent_profiles").update({ phone }).ilike("email", email).then(() => undefined, () => undefined);
      await db()
        .from("aoprecheck_2fa")
        .upsert({ email, phone, verified: true, updated_at: new Date().toISOString() }, { onConflict: "email" })
        .then(() => undefined, () => undefined);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "sms_verify_failed" });
    }
  });

  app.post("/api/auth/forgot", express.json(), async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.body?.email);
      const method = String(req.body?.method || "sms");
      const valid = (p: string) => !!p && p.replace(/\D/g, "").length >= 11;
      const pickPhone = (row: any): string => {
        if (!row) return "";
        for (const k of Object.keys(row)) {
          if (/phone|mobile|cell/i.test(k)) {
            const p = normalizePhoneE164(String(row[k] || ""));
            if (valid(p)) return p;
          }
        }
        return "";
      };
      if (method === "sms") {
        let phone = "";
        const explicit = normalizePhoneE164(String(req.body?.phone || ""));
        if (valid(explicit)) phone = explicit;
        if (!phone) {
          try {
            const { data: tfa } = await db().from("aoprecheck_2fa").select("*").eq("email", email).maybeSingle();
            phone = pickPhone(tfa);
          } catch { /* optional table */ }
        }
        if (!phone) {
          const { data: prof } = await db().from("agent_profiles").select("*").ilike("email", email).maybeSingle();
          phone = pickPhone(prof);
        }
        if (!phone) {
          const { data: cust } = await db()
            .from("customers")
            .select("*")
            .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
            .limit(1)
            .maybeSingle();
          phone = pickPhone(cust);
        }
        if (valid(phone)) {
          await sendOtp(email, phone);
          const masked = phone.replace(/.(?=.{4})/g, "*");
          return res.json({ ok: true, sent: true, phone_masked: masked });
        }
        return res.json({ ok: true, sent: false, reason: "no_phone_on_file" });
      }
      const token = makeResetToken(email);
      const link = `${APP_BASE}/reset?token=${token}&email=${encodeURIComponent(email)}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #eaecf2;border-radius:14px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;padding:22px 28px"><h1 style="margin:0;font-size:20px">AO Precheck</h1></div>
          <div style="padding:28px">
            <h2 style="margin:0 0 10px;color:#0f1729;font-size:18px">Reset your password</h2>
            <p style="color:#475067;font-size:14px">Reset the password for <b>${email}</b>. Link expires in 30 minutes.</p>
            <p style="margin:22px 0"><a href="${link}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700">Set a new password</a></p>
          </div>
        </div>`;
      const sent = await sendEmail({
        to: email,
        subject: "Reset your AO Precheck password",
        text: `Reset your AO Precheck password: ${link}`,
        html,
      });
      return res.json({ ok: true, method: "email", sent: !!sent });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "forgot_failed" });
    }
  });

  app.post("/api/auth/reset", express.json(), async (req: Request, res: Response) => {
    try {
      const email = normEmail(req.body?.email);
      const code = String(req.body?.code || "").trim();
      const token = String(req.body?.token || "").trim();
      const newPassword = String(req.body?.newPassword || "");
      if (newPassword.length < 8) return res.status(400).json({ error: "password too short" });
      let verified = false;
      if (token) verified = checkResetToken(token, email);
      else if (code) verified = checkOtp(email, code);
      if (!verified) return res.status(400).json({ error: "invalid or expired reset link/code" });
      const userId = await findAuthUserId(email);
      if (!userId) return res.status(404).json({ error: "no account found for that email" });
      const { error } = await db().auth.admin.updateUserById(userId, { password: newPassword });
      if (error) return res.status(500).json({ error: error.message });
      if (token) resetTokens.delete(token);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "reset_failed" });
    }
  });

  /* TEAM — same slide-out UX as AO Recruit */
  app.get("/api/team", async (req: Request, res: Response) => {
    try {
      const mgr = normEmail(req.query.managerEmail as string) || managerEmailOf(req);
      await ensureAoPrecheckTeamTables();
      const tr = await teamPool.query(`SELECT id,name FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [mgr]);
      const team = tr.rows[0];
      if (!team) return res.json({ teamName: null, members: [], pendingMembers: [], pendingCount: 0, confirmedCount: 0 });
      const mr = await teamPool.query(
        `SELECT email, membership_status, confirm_sent_at, confirmed_at FROM aoprecheck_team_members WHERE team_id=$1`,
        [team.id],
      );
      const inv = await teamPool.query(
        `SELECT email, membership_status, confirm_sent_at, confirmed_at FROM aoprecheck_team_invites
         WHERE team_id=$1 OR (team_id IS NULL AND lower(invited_by)=lower($2))`,
        [team.id, mgr],
      );
      const memberByEmail = new Map<string, any>();
      (mr.rows || []).forEach((m: any) => memberByEmail.set(normEmail(m.email), m));
      (inv.rows || []).forEach((i: any) => {
        const em = normEmail(i.email);
        if (!memberByEmail.has(em)) memberByEmail.set(em, { ...i, inviteOnly: true });
      });
      const emails = [...memberByEmail.keys()].filter(Boolean);
      let rows: any[] = [];
      if (emails.length) {
        const orFilter = emails.map((e) => `company_email.ilike.${e},personal_email.ilike.${e}`).join(",");
        const { data: custs } = await db()
          .from("customers")
          .select("company_email,personal_email,first_name,last_name,agent_name,associate_id")
          .or(orFilter);
        const custByEmail = new Map<string, any>();
        (custs || []).forEach((c: any) => {
          [c.company_email, c.personal_email].forEach((e: any) => { const k = normEmail(e || ""); if (k) custByEmail.set(k, c); });
        });
        const { data: creds } = await db().from("user_credits").select("email,credits_remaining").in("email", emails);
        const credByEmail = new Map((creds || []).map((c: any) => [normEmail(c.email), c.credits_remaining || 0]));
        rows = emails.map((em) => {
          const meta = memberByEmail.get(em) || {};
          const c = custByEmail.get(em);
          const name = String(c?.agent_name || [c?.first_name, c?.last_name].filter(Boolean).join(" ")).trim() || em;
          const membershipStatus = meta.membership_status === "confirmed" ? "confirmed" : "pending";
          return {
            email: em,
            name,
            associate_id: c?.associate_id,
            credits: credByEmail.get(em) ?? 0,
            status: "offline" as const,
            membershipStatus,
            confirmSentAt: meta.confirm_sent_at || null,
            confirmedAt: meta.confirmed_at || null,
            inviteOnly: !!meta.inviteOnly,
          };
        });
      }
      const pendingMembers = rows.filter((r) => r.membershipStatus === "pending");
      const confirmedMembers = rows.filter((r) => r.membershipStatus === "confirmed");
      return res.json({
        teamId: team.id,
        teamName: team.name,
        members: rows,
        pendingMembers,
        confirmedMembers,
        pendingCount: pendingMembers.length,
        confirmedCount: confirmedMembers.length,
      });
    } catch (e: any) {
      return res.json({ teamName: null, members: [], pendingMembers: [], pendingCount: 0, confirmedCount: 0, error: e?.message });
    }
  });

  /** Normalize a verification_sessions row for team manager UI. */
  function normalizeManagerSession(session: Record<string, unknown>) {
    const statusRaw = session.status ?? "pending";
    const clientFirstName = String(session.first_name || "");
    const clientLastName = String(session.last_name || "");
    const combinedClientName = `${clientFirstName} ${clientLastName}`.trim();
    return {
      id: session.id,
      sessionId: session.session_id || session.id,
      clientName: combinedClientName || "Unknown Client",
      clientPhone: session.client_phone || session.phone || session.phone_number || null,
      agentEmail: session.company_email || null,
      status: statusRaw,
      transmitStatus: session.transmit_status || "pending_transmit",
      createdAt: session.created_at || null,
      method: session.verification_method || "phone",
    };
  }

  async function resolveManagerTeamEmails(manager: string): Promise<string[]> {
    await ensureAoPrecheckTeamTables();
    const emails = new Set<string>([normEmail(manager)]);
    const tr = await teamPool.query(
      `SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`,
      [manager],
    );
    if (tr.rows[0]?.id) {
      const mr = await teamPool.query(
        `SELECT email FROM aoprecheck_team_members WHERE team_id=$1 AND membership_status='confirmed'`,
        [tr.rows[0].id],
      );
      (mr.rows || []).forEach((r: { email?: string }) => {
        const e = normEmail(r.email || "");
        if (e) emails.add(e);
      });
    }
    return [...emails];
  }

  /**
   * Team manager precheck list — sessions for manager + invited team members.
   * Tab buckets (client-side):
   *   Pending    — transmit_status not transmitted and not scheduled_delete
   *   Transmitted — transmitted but status not yet completed/verification_completed
   *   Verified   — transmitted AND status in (completed, verification_completed)
   */
  app.get("/api/aoi-precheck/team/manager-sessions", async (req: Request, res: Response) => {
    try {
      const mgr = normEmail((req.query.managerEmail as string) || "") || managerEmailOf(req);
      if (!mgr) return res.status(400).json({ success: false, error: "managerEmail required" });

      const caller = reqEmail(req);
      if (caller && caller !== mgr) {
        return res.status(403).json({ success: false, error: "not authorized for this team" });
      }

      const teamEmails = await resolveManagerTeamEmails(mgr);
      const teamEmailSet = new Set(teamEmails.map((e) => normEmail(e)));
      if (!supabaseAdmin) return res.status(500).json({ success: false, error: "Service unavailable" });

      // select("*") — verification_sessions has first_name/last_name, not client_name
      const orClause = teamEmails.map((e) => `company_email.ilike.${normEmail(e)}`).join(",");
      const { data, error } = await supabaseAdmin
        .from("verification_sessions")
        .select("*")
        .or(orClause)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("[aoprecheck] manager-sessions fetch failed:", error.message);
        return res.status(500).json({ success: false, error: error.message || "fetch_failed" });
      }

      const now = new Date();
      const sessions = (data || [])
        .filter((session: Record<string, unknown>) => {
          const em = normEmail(String(session.company_email || ""));
          if (!teamEmailSet.has(em)) return false;
          const scheduledDelete = session.scheduled_delete_at
            ? new Date(String(session.scheduled_delete_at))
            : null;
          if (scheduledDelete && scheduledDelete.getTime() <= now.getTime()) return false;
          return true;
        })
        .map((session: Record<string, unknown>) => normalizeManagerSession(session));

      return res.json({ success: true, managerEmail: mgr, teamSize: teamEmails.length, sessions });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ success: false, error: msg || "manager_sessions_failed", sessions: [] });
    }
  });

  app.get("/api/team/sessions", async (req: Request, res: Response) => {
    try {
      const mgr = normEmail(req.query.managerEmail as string) || managerEmailOf(req);
      if (!mgr) return res.status(400).json({ error: "managerEmail required" });
      await ensureAoPrecheckTeamTables();
      const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [mgr]);
      if (!tr.rows[0]) return res.json({ date: new Date().toISOString().slice(0, 10), members: [] });
      const mr = await teamPool.query(
        `SELECT email FROM aoprecheck_team_members WHERE team_id=$1 AND membership_status='confirmed'`,
        [tr.rows[0].id],
      );
      const members = (mr.rows || []).map((r: any) => ({
        email: normEmail(r.email),
        todayOnlineMinutes: 0,
        currentSessionStartUtc: null,
        sessions: [],
      }));
      return res.json({ date: new Date().toISOString().slice(0, 10), members });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "team_sessions_failed", members: [] });
    }
  });

  app.post("/api/team/add", express.json(), async (req: Request, res: Response) => {
    try {
      const manager = managerEmailOf(req);
      if (!manager) return res.status(401).json({ error: "auth required" });
      const email = normEmail(req.body?.email);
      if (!email || !email.includes("@")) return res.status(400).json({ error: "valid email required" });
      await ensureAoPrecheckTeamTables();
      const teamId = await ensureManagerTeamId(manager, String(req.body?.teamId || ""));
      const token = makeConfirmToken();
      const { data: cust } = await db()
        .from("customers")
        .select("company_email,personal_email")
        .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
        .limit(1)
        .maybeSingle();
      if (!cust) {
        await teamPool.query(
          `INSERT INTO aoprecheck_team_invites(id,email,invited_by,team_id,membership_status,confirm_token,confirm_sent_at)
           VALUES ($1,$2,$3,$4,'pending',$5,now())
           ON CONFLICT (id) DO NOTHING`,
          [randomUUID(), email, manager, teamId, token],
        ).catch(() => {});
        await teamPool.query(
          `UPDATE aoprecheck_team_invites SET team_id=$1, membership_status='pending', confirm_token=$2, confirm_sent_at=now()
           WHERE lower(email)=lower($3) AND (team_id IS NULL OR team_id=$1)`,
          [teamId, token, email],
        );
        const sent = await sendTeamConfirmEmail(email, manager, token);
        return res.json({ ok: true, teamId, email, membershipStatus: "pending", confirmationSent: !!sent, invited: true });
      }
      await teamPool.query(
        `INSERT INTO aoprecheck_team_members(team_id,email,membership_status,confirm_token,confirm_sent_at)
         VALUES ($1,$2,'pending',$3,now())
         ON CONFLICT (team_id,email) DO UPDATE SET
           membership_status = CASE WHEN aoprecheck_team_members.membership_status = 'confirmed' THEN 'confirmed' ELSE 'pending' END,
           confirm_token = CASE WHEN aoprecheck_team_members.membership_status = 'confirmed' THEN aoprecheck_team_members.confirm_token ELSE EXCLUDED.confirm_token END,
           confirm_sent_at = CASE WHEN aoprecheck_team_members.membership_status = 'confirmed' THEN aoprecheck_team_members.confirm_sent_at ELSE now() END`,
        [teamId, email, token],
      );
      const statusRow = await teamPool.query(
        `SELECT membership_status, confirm_token FROM aoprecheck_team_members WHERE team_id=$1 AND lower(email)=lower($2) LIMIT 1`,
        [teamId, email],
      );
      const membershipStatus = statusRow.rows[0]?.membership_status === "confirmed" ? "confirmed" : "pending";
      let confirmationSent = false;
      if (membershipStatus === "pending") {
        confirmationSent = await sendTeamConfirmEmail(email, manager, statusRow.rows[0]?.confirm_token || token);
      }
      return res.json({ ok: true, teamId, email, membershipStatus, confirmationSent });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "add_failed" });
    }
  });

  app.post("/api/team/invite", express.json(), async (req: Request, res: Response) => {
    try {
      const mgr = managerEmailOf(req);
      if (!mgr) return res.status(401).json({ error: "auth required" });
      const email = normEmail(req.body?.email);
      if (!okDomain(email)) return res.status(400).json({ error: "must use @aoglobelife.com" });
      await ensureAoPrecheckTeamTables();
      const teamId = await ensureManagerTeamId(mgr, String(req.body?.teamId || ""));
      const token = makeConfirmToken();
      await teamPool.query(
        `INSERT INTO aoprecheck_team_invites(id,email,invited_by,team_id,membership_status,confirm_token,confirm_sent_at)
         VALUES ($1,$2,$3,$4,'pending',$5,now())`,
        [randomUUID(), email, mgr, teamId, token],
      );
      await teamPool.query(
        `UPDATE aoprecheck_team_invites SET team_id=$1, membership_status='pending', confirm_token=$2, confirm_sent_at=now(), invited_by=$3
         WHERE lower(email)=lower($4)`,
        [teamId, token, mgr, email],
      );
      const sent = await sendTeamConfirmEmail(email, mgr, token);
      return res.json({ ok: true, teamId, email, membershipStatus: "pending", confirmationSent: !!sent });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "invite_failed" });
    }
  });

  app.post("/api/team/resend-confirmation", express.json(), async (req: Request, res: Response) => {
    try {
      const mgr = managerEmailOf(req);
      if (!mgr) return res.status(401).json({ error: "auth required" });
      const email = normEmail(req.body?.email);
      if (!email) return res.status(400).json({ error: "email required" });
      await ensureAoPrecheckTeamTables();
      let teamId = String(req.body?.teamId || "");
      if (!teamId) teamId = await ensureManagerTeamId(mgr);
      const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE id=$1 AND lower(manager_email)=lower($2) LIMIT 1`, [teamId, mgr]);
      if (!tr.rows[0]) return res.status(403).json({ error: "not authorized for this team" });

      const mr = await teamPool.query(
        `SELECT confirm_token, membership_status FROM aoprecheck_team_members WHERE team_id=$1 AND lower(email)=lower($2) LIMIT 1`,
        [teamId, email],
      );
      if (mr.rows[0]) {
        if (mr.rows[0].membership_status === "confirmed") return res.status(400).json({ error: "already confirmed" });
        let token = mr.rows[0].confirm_token || makeConfirmToken();
        if (!mr.rows[0].confirm_token) {
          await teamPool.query(
            `UPDATE aoprecheck_team_members SET confirm_token=$1, confirm_sent_at=now() WHERE team_id=$2 AND lower(email)=lower($3)`,
            [token, teamId, email],
          );
        } else {
          await teamPool.query(
            `UPDATE aoprecheck_team_members SET confirm_sent_at=now() WHERE team_id=$1 AND lower(email)=lower($2)`,
            [teamId, email],
          );
        }
        await sendTeamConfirmEmail(email, mgr, token);
        return res.json({ ok: true });
      }

      const ir = await teamPool.query(
        `SELECT confirm_token, membership_status FROM aoprecheck_team_invites WHERE team_id=$1 AND lower(email)=lower($2) LIMIT 1`,
        [teamId, email],
      );
      if (!ir.rows[0]) return res.status(404).json({ error: "pending member not found" });
      if (ir.rows[0].membership_status === "confirmed") return res.status(400).json({ error: "already confirmed" });
      let token = ir.rows[0].confirm_token || makeConfirmToken();
      if (!ir.rows[0].confirm_token) {
        await teamPool.query(
          `UPDATE aoprecheck_team_invites SET confirm_token=$1, confirm_sent_at=now() WHERE team_id=$2 AND lower(email)=lower($3)`,
          [token, teamId, email],
        );
      } else {
        await teamPool.query(
          `UPDATE aoprecheck_team_invites SET confirm_sent_at=now() WHERE team_id=$1 AND lower(email)=lower($2)`,
          [teamId, email],
        );
      }
      await sendTeamConfirmEmail(email, mgr, token);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "resend_failed" });
    }
  });

  app.get("/api/team/confirm", async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token || "");
      const result = await confirmTeamMembershipByToken(token);
      if (!result.ok) {
        if (req.headers.accept?.includes("application/json")) return res.status(400).json(result);
        return res.redirect(302, "/app?teamConfirmError=1");
      }
      if (req.headers.accept?.includes("application/json")) return res.json({ ok: true });
      return res.redirect(302, "/app?teamConfirmed=1");
    } catch (e: any) {
      if (req.headers.accept?.includes("application/json")) return res.status(500).json({ error: e?.message });
      return res.redirect(302, "/app?teamConfirmError=1");
    }
  });

  app.delete("/api/team/member", express.json(), async (req: Request, res: Response) => {
    try {
      const mgr = managerEmailOf(req);
      if (!mgr) return res.status(401).json({ error: "auth required" });
      await ensureAoPrecheckTeamTables();
      let teamId = String(req.body?.teamId || req.query?.teamId || "");
      if (!teamId) {
        const tr = await teamPool.query(`SELECT id FROM aoprecheck_teams WHERE lower(manager_email)=lower($1) LIMIT 1`, [mgr]);
        if (tr.rows[0]?.id) teamId = String(tr.rows[0].id);
      }
      const email = normEmail((req.body?.email as string) || (req.query?.email as string));
      if (teamId && email) {
        await teamPool.query(`DELETE FROM aoprecheck_team_members WHERE team_id=$1 AND email=$2`, [teamId, email]);
        await teamPool.query(`DELETE FROM aoprecheck_team_invites WHERE team_id=$1 AND lower(email)=lower($2)`, [teamId, email]);
      }
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "remove_failed" });
    }
  });

  console.log(`✅ AO Precheck routes registered (${AOPRECHECK_BUILD_ID})`);
}
