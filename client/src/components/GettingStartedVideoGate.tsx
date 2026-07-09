import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Mandatory "Getting Started" welcome video — identical UX across all four AO
 * apps (AO Connect, AO Recruit, AO Precheck, AO Analytics).
 *
 * Behavior:
 *  - Shown once on a user's first login, as a modal that CANNOT be skipped:
 *    the user must watch the video to completion before they can continue.
 *  - Completion is tracked per user + app + version (localStorage, versioned so
 *    a new video can force a re-watch by bumping GETTING_STARTED_VERSION). A
 *    best-effort server sync is attempted but never required.
 *  - A "Getting Started" link (GettingStartedButton) re-opens the video anytime;
 *    re-watch is NOT mandatory and can be closed freely.
 *
 * PLACEHOLDER: the real video URL is not set yet. Drop it in per app via the
 * env var VITE_GETTING_STARTED_VIDEO_URL (or edit GETTING_STARTED_VIDEO_URL
 * below). Until then a timed placeholder still enforces the watch-to-completion
 * gate so the UX is fully functional. A real URL "just works".
 */

// ── Swappable config ────────────────────────────────────────────────────────
/** Bump to force everyone to re-watch when the video changes. */
export const GETTING_STARTED_VERSION = "v2";
/**
 * Real video source. AO Precheck ships the real "How to do a Precheck call"
 * how-to below (baked into the bundle so it works regardless of env). Setting
 * VITE_GETTING_STARTED_VIDEO_URL at build time overrides it.
 */
const PRECHECK_GETTING_STARTED_VIDEO_URL =
  "https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/ao_intelligence_-_how_to_do_a_precheck_call%20(1080p).mp4";
export const GETTING_STARTED_VIDEO_URL: string =
  (((import.meta as any)?.env?.VITE_GETTING_STARTED_VIDEO_URL as string | undefined) || PRECHECK_GETTING_STARTED_VIDEO_URL).trim();
/** Optional poster/thumbnail image. */
export const GETTING_STARTED_POSTER: string =
  (((import.meta as any)?.env?.VITE_GETTING_STARTED_POSTER as string | undefined) || "").trim();
/** Seconds the timed placeholder "plays" before Continue unlocks. */
const PLACEHOLDER_SECONDS = 20;

export type AoAppId = "connect" | "recruit" | "precheck" | "analytics";

const APP_TITLES: Record<AoAppId, string> = {
  connect: "AO Connect",
  recruit: "AO Recruit",
  precheck: "AO Precheck",
  analytics: "AO Analytics",
};

export function detectAoApp(): AoAppId {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    const forced = (new URLSearchParams(window.location.search).get("aoapp") || "").toLowerCase();
    const envApp = ((import.meta as any)?.env?.VITE_AO_APP as string | undefined || "").toLowerCase();
    const v = forced || envApp;
    if (v === "connect" || v === "recruit" || v === "precheck" || v === "analytics") return v;
    if (host.includes("aoconnect")) return "connect";
    if (host.includes("aorecruit")) return "recruit";
    if (host.includes("aoprecheck")) return "precheck";
    if (host.includes("analytics")) return "analytics";
  }
  return "recruit";
}

function storageKey(app: AoAppId, userKey?: string | null) {
  return `ao_getting_started_done::${app}::${GETTING_STARTED_VERSION}::${(userKey || "anon").trim().toLowerCase()}`;
}

export function isGettingStartedDone(app: AoAppId, userKey?: string | null): boolean {
  try {
    return localStorage.getItem(storageKey(app, userKey)) === "1";
  } catch {
    return false;
  }
}

function markGettingStartedDone(app: AoAppId, userKey?: string | null) {
  try {
    localStorage.setItem(storageKey(app, userKey), "1");
  } catch {
    /* ignore */
  }
  // Best-effort server sync — never required, failures are ignored.
  try {
    void fetch("/api/getting-started/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ app, version: GETTING_STARTED_VERSION, email: userKey || null }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Local cache only (no server write) — used to avoid a flash for users the
 *  server has already confirmed complete. The SERVER remains authoritative. */
function setGettingStartedLocal(app: AoAppId, userKey?: string | null) {
  try {
    localStorage.setItem(storageKey(app, userKey), "1");
  } catch {
    /* ignore */
  }
}

/** Ask the SERVER whether this agent has completed the current version. This is
 *  authoritative — clearing localStorage or switching devices cannot bypass it. */
async function fetchServerGettingStartedCompleted(email: string): Promise<boolean> {
  const r = await fetch(
    `/api/getting-started/status?email=${encodeURIComponent(email)}&version=${encodeURIComponent(GETTING_STARTED_VERSION)}`,
    { credentials: "include" },
  );
  if (!r.ok) throw new Error(`status ${r.status}`);
  const d = await r.json();
  return !!(d && d.completed);
}

/** Persist completion to the SERVER (awaited). Returns true on success. */
async function postServerGettingStartedComplete(email: string): Promise<boolean> {
  try {
    const r = await fetch("/api/getting-started/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, version: GETTING_STARTED_VERSION }),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => ({}));
    return !!(d && d.ok);
  } catch {
    return false;
  }
}

/** Window event any part of the app can dispatch to re-open the video. */
export const OPEN_GETTING_STARTED_EVENT = "ao-open-getting-started";

export function openGettingStarted() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_GETTING_STARTED_EVENT));
}

// ── The gate ────────────────────────────────────────────────────────────────
interface Props {
  /** Current user key (email) for per-user tracking. */
  userKey?: string | null;
  /** Whether the user is authenticated — the mandatory gate only shows when true. */
  authed?: boolean;
  /** Override the detected app (optional). */
  app?: AoAppId;
}

export function GettingStartedVideoGate({ userKey, authed = true, app }: Props) {
  const appId = app || detectAoApp();
  const appTitle = APP_TITLES[appId];

  const [open, setOpen] = useState(false);
  const [mandatory, setMandatory] = useState(false);
  const [pct, setPct] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  // AO Precheck adds mandatory acknowledgment + profile-setup steps after the video.
  const [step, setStep] = useState<"video" | "ack" | "profile">("video");
  const [ackProfile, setAckProfile] = useState(false);
  const [ackApprovals, setAckApprovals] = useState(false);
  const [ackTransmit, setAckTransmit] = useState(false);
  // Profile-setup step — reads/writes the SAME record verification consumes
  // (/api/agent/profile-direct). Zoom + phone required; manager data omitted.
  const [profLoaded, setProfLoaded] = useState(false);
  const [profSaving, setProfSaving] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);
  const [profFirst, setProfFirst] = useState("");
  const [profLast, setProfLast] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profZoomId, setProfZoomId] = useState("");
  const [profZoomPw, setProfZoomPw] = useState("1");
  const [profApproved, setProfApproved] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const placeholderStartRef = useRef<number | null>(null);

  const hasRealVideo = GETTING_STARTED_VIDEO_URL.length > 0;

  // First-login mandatory check.
  //  - AO Precheck: SERVER-AUTHORITATIVE. We ask the server whether this agent
  //    has completed the current version; localStorage is only a fast cache to
  //    avoid a flash for already-completed users. Clearing localStorage or
  //    switching devices cannot bypass it — the server decides.
  //  - Other apps: localStorage-only (unchanged).
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const email = (userKey || "").trim();

    const forceFlow = () => {
      if (cancelled) return;
      setMandatory(true);
      setStep("video");
      setOpen(true);
    };

    if (appId === "precheck") {
      (async () => {
        try {
          const completed = await fetchServerGettingStartedCompleted(email);
          if (cancelled) return;
          if (completed) {
            setGettingStartedLocal(appId, userKey); // cache for next load
          } else {
            forceFlow(); // server says not done → mandatory, even if localStorage says done
          }
        } catch {
          // Status call failed — fall back to the localStorage cache so we don't
          // hard-block a legitimate agent on a transient network blip, but if
          // there's no cached completion we still enforce the flow.
          if (!cancelled && !isGettingStartedDone(appId, userKey)) forceFlow();
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Non-precheck apps: localStorage behavior (unchanged).
    if (isGettingStartedDone(appId, userKey)) return;
    const t = window.setTimeout(forceFlow, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [authed, appId, userKey]);

  // Re-watch trigger.
  useEffect(() => {
    const onOpen = () => {
      setMandatory(false);
      setPct(0);
      setStarted(false);
      setFinished(false);
      setStep("video");
      setAckProfile(false);
      setAckApprovals(false);
      setAckTransmit(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_GETTING_STARTED_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GETTING_STARTED_EVENT, onOpen);
  }, []);

  // When we reach the profile step, prefill from the verification profile record.
  useEffect(() => {
    if (step !== "profile" || profLoaded) return;
    let cancelled = false;
    const email = (userKey || "").trim();
    (async () => {
      try {
        const r = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(email)}`, {
          credentials: "include",
        });
        if (r.ok) {
          const p = await r.json();
          if (!cancelled && p) {
            setProfFirst(p.firstName || "");
            setProfLast(p.lastName || "");
            setProfPhone(p.phone || "");
            setProfZoomId(p.zoomId || "");
            setProfZoomPw(p.zoomPassword || "1");
          }
        }
      } catch {
        /* ignore — user can still fill it in */
      } finally {
        if (!cancelled) setProfLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, profLoaded, userKey]);

  const complete = useCallback(() => {
    setFinished(true);
    setPct(100);
    // On the mandatory precheck flow, completion is only recorded AFTER the
    // acknowledgment step. Other flows record it as soon as the video ends.
    if (mandatory && appId !== "precheck") markGettingStartedDone(appId, userKey);
  }, [mandatory, appId, userKey]);

  // Timed placeholder animation.
  const tickPlaceholder = useCallback(() => {
    if (placeholderStartRef.current == null) placeholderStartRef.current = performance.now();
    const elapsed = (performance.now() - placeholderStartRef.current) / 1000;
    const p = Math.min(100, (elapsed / PLACEHOLDER_SECONDS) * 100);
    setPct(p);
    if (p >= 100) {
      complete();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    } else {
      rafRef.current = requestAnimationFrame(tickPlaceholder);
    }
  }, [complete]);

  const startPlayback = useCallback(() => {
    setStarted(true);
    if (hasRealVideo) {
      videoRef.current?.play().catch(() => {});
    } else {
      placeholderStartRef.current = null;
      rafRef.current = requestAnimationFrame(tickPlaceholder);
    }
  }, [hasRealVideo, tickPlaceholder]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Precheck's mandatory flow requires an acknowledgment step after the video.
  const requiresAck = mandatory && appId === "precheck";
  const acksComplete = ackProfile && ackApprovals && ackTransmit;
  // Hard gate: on the mandatory precheck flow the modal can't be dismissed until
  // the video is watched AND the acknowledgments are confirmed.
  const canClose = !mandatory || (finished && !requiresAck);

  const closeIfAllowed = useCallback(() => {
    if (!canClose) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setOpen(false);
  }, [canClose]);

  // Match Connect/aoirail profile: first + last are required (verification Next uses them).
  const profileComplete =
    profFirst.trim().length > 0 &&
    profLast.trim().length > 0 &&
    profPhone.trim().length > 0 &&
    profZoomId.trim().length > 0 &&
    profApproved;

  const saveProfileAndFinish = useCallback(async () => {
    if (!profileComplete || profSaving) return;
    setProfSaving(true);
    setProfError(null);
    try {
      const first = profFirst.trim();
      const last = profLast.trim();
      if (!first || !last) {
        setProfError("First name and last name are required.");
        setProfSaving(false);
        return;
      }
      const r = await fetch("/api/agent/profile-direct", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: first,
          lastName: last,
          phone: profPhone,
          zoomId: profZoomId,
          // Numeric only; never empty — default to "1".
          zoomPassword: profZoomPw.replace(/\D/g, "").trim() || "1",
          userEmail: (userKey || "").trim(),
        }),
      });
      if (!r.ok) throw new Error("save failed");
      // Keep verification form fallbacks in sync (client-form reads these).
      localStorage.setItem("agent_first_name", first);
      localStorage.setItem("agent_last_name", last);
      localStorage.setItem("agent_phone", profPhone.trim());
      localStorage.setItem("agent_zoom_room_id", profZoomId.trim());
      localStorage.setItem("agent_zoom_password", profZoomPw.replace(/\D/g, "").trim() || "1");
      // Record completion on the SERVER (authoritative) BEFORE closing, so the
      // agent can't be re-prompted / can't bypass by clearing local storage.
      const serverOk = await postServerGettingStartedComplete((userKey || "").trim());
      if (!serverOk) throw new Error("complete failed");
      setGettingStartedLocal(appId, userKey); // fast-path cache
      setOpen(false);
    } catch {
      setProfError("Couldn't save your profile — please check your connection and try again.");
    } finally {
      setProfSaving(false);
    }
  }, [profileComplete, profSaving, profFirst, profLast, profPhone, profZoomId, profZoomPw, appId, userKey]);

  const proceed = useCallback(() => {
    if (step === "video") {
      if (mandatory && !finished) return;
      if (requiresAck) {
        setStep("ack");
        return;
      }
      if (mandatory) markGettingStartedDone(appId, userKey);
      setOpen(false);
      return;
    }
    if (step === "ack") {
      // Both boxes must be checked; then move on to mandatory profile setup.
      if (!acksComplete) return;
      setStep("profile");
      return;
    }
    // Profile step: save the verification profile, then finish.
    void saveProfileAndFinish();
  }, [step, mandatory, finished, requiresAck, acksComplete, appId, userKey, saveProfileAndFinish]);

  const overlay = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      inset: 0,
      zIndex: 100000,
      background: "rgba(15,23,41,.62)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }),
    [],
  );

  if (!open) return null;

  return (
    <div style={overlay} onClick={closeIfAllowed} aria-modal role="dialog">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // ~2x larger video for senior users — capped to the viewport so it stays centered and on-screen.
          width: "min(1400px, 94vw)",
          maxHeight: "94vh",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 30px 80px rgba(15,23,41,.4)",
          overflow: "hidden",
          border: "1px solid #e7eaf0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid #eef1f5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              ▶
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0f1729" }}>
                {step === "ack"
                  ? "Before you continue"
                  : step === "profile"
                  ? "Set up your profile"
                  : `Getting Started with ${appTitle}`}
              </div>
              <div style={{ fontSize: 12.5, color: "#8b94a7" }}>
                {step === "ack"
                  ? "Please confirm the following to finish setting up."
                  : step === "profile"
                  ? "Add your Zoom and phone details — verification uses these. Review and approve to finish."
                  : mandatory
                  ? "Please watch this short intro all the way through to continue."
                  : "Welcome back — here's the intro anytime you need it."}
              </div>
            </div>
            {canClose && (
              <button
                type="button"
                onClick={closeIfAllowed}
                title="Close"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  border: "1px solid #e7eaf0",
                  background: "#fff",
                  color: "#56607a",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Player */}
        {step === "video" && (
        <div style={{ position: "relative", background: "#0f1729", aspectRatio: "16 / 9", width: "100%", maxHeight: "74vh", flexShrink: 0 }}>
          {hasRealVideo ? (
            <video
              ref={videoRef}
              src={GETTING_STARTED_VIDEO_URL}
              poster={GETTING_STARTED_POSTER || undefined}
              playsInline
              controls={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setPct(Math.min(100, (v.currentTime / v.duration) * 100));
              }}
              onEnded={complete}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#c7cede",
                background:
                  GETTING_STARTED_POSTER
                    ? `center/cover no-repeat url(${GETTING_STARTED_POSTER})`
                    : "radial-gradient(circle at 50% 40%, #1e2740, #0f1729)",
                textAlign: "center",
                padding: 24,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.75 }}>
                Placeholder Intro
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginTop: 6 }}>
                {appTitle} Welcome Video
              </div>
              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6, maxWidth: 420 }}>
                The real video hasn't been added yet. This placeholder still enforces watch-to-completion.
              </div>
            </div>
          )}

          {/* Play button (before start) */}
          {!started && (
            <button
              type="button"
              onClick={startPlayback}
              style={{
                position: "absolute",
                inset: 0,
                margin: "auto",
                width: 76,
                height: 76,
                borderRadius: "50%",
                border: "none",
                background: "rgba(124,58,237,.92)",
                color: "#fff",
                fontSize: 30,
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(124,58,237,.5)",
              }}
              title="Play"
            >
              ▶
            </button>
          )}
        </div>
        )}

        {/* Acknowledgment step (AO Precheck only) */}
        {step === "ack" && (
          <div style={{ padding: "20px 22px 4px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#56607a", lineHeight: 1.5 }}>
              You've finished the intro. Please confirm you understand the following before continuing:
            </p>
            {[
              {
                checked: ackProfile,
                set: setAckProfile,
                text: "I will need to edit my profile and add my first name, last name, phone number, and Zoom info.",
              },
              {
                checked: ackApprovals,
                set: setAckApprovals,
                text: "I may receive additional approval notifications from my quality team that require my approval.",
              },
              {
                checked: ackTransmit,
                set: setAckTransmit,
                text: "My precheck is NOT complete until I Transmit for review — I must click Transmit in the left \u201CMy prechecks\u201D menu to submit it.",
              },
            ].map((item, i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px 14px",
                  marginBottom: 10,
                  borderRadius: 12,
                  border: `1px solid ${item.checked ? "#7c3aed" : "#e7eaf0"}`,
                  background: item.checked ? "#f6f2fe" : "#fbfcfd",
                  cursor: "pointer",
                  transition: "border-color .12s, background .12s",
                }}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.set(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: "#7c3aed", flexShrink: 0, cursor: "pointer" }}
                />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f1729", lineHeight: 1.45 }}>{item.text}</span>
              </label>
            ))}
          </div>
        )}

        {/* Profile setup step (AO Precheck only) */}
        {step === "profile" && (
          <div style={{ padding: "18px 22px 4px", maxHeight: "52vh", overflowY: "auto" }}>
            {!profLoaded ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "#8b94a7", fontSize: 13 }}>Loading your profile…</div>
            ) : (
              <>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#56607a", lineHeight: 1.5 }}>
                  This is the same profile the precheck verification uses. Your{" "}
                  <strong>first name</strong>, <strong>last name</strong>, <strong>phone number</strong>, and{" "}
                  <strong>Zoom Room ID</strong> are required.
                </p>
                {(() => {
                  const labelStyle: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#0f1729", marginBottom: 5 };
                  const inputStyle: React.CSSProperties = {
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 10,
                    border: "1px solid #e7eaf0",
                    fontSize: 13.5,
                    color: "#0f1729",
                    outline: "none",
                    boxSizing: "border-box",
                  };
                  const req = (v: string): React.CSSProperties => (v.trim() ? {} : { border: "1px solid #f0b4ae", background: "#fff8f7" });
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>First name *</label>
                          <input
                            style={{ ...inputStyle, ...req(profFirst) }}
                            value={profFirst}
                            onChange={(e) => setProfFirst(e.target.value)}
                            placeholder="Alex"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Last name *</label>
                          <input
                            style={{ ...inputStyle, ...req(profLast) }}
                            value={profLast}
                            onChange={(e) => setProfLast(e.target.value)}
                            placeholder="Swift"
                          />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Phone number *</label>
                        <input
                          style={{ ...inputStyle, ...req(profPhone) }}
                          value={profPhone}
                          onChange={(e) => setProfPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          inputMode="tel"
                        />
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 2 }}>
                          <label style={labelStyle}>Zoom Room ID *</label>
                          <input
                            style={{ ...inputStyle, ...req(profZoomId) }}
                            value={profZoomId}
                            onChange={(e) => setProfZoomId(e.target.value)}
                            placeholder="6179755704"
                            inputMode="numeric"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Zoom passcode</label>
                          <input
                            style={inputStyle}
                            value={profZoomPw}
                            onChange={(e) => setProfZoomPw(e.target.value.replace(/\D/g, ""))}
                            placeholder="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                          <div style={{ fontSize: 11, color: "#8b94a7", marginTop: 5, lineHeight: 1.4 }}>
                            Passcode must be numbers only (letters aren't supported for phone/dial-in join). Leave blank to default to 1.
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "13px 14px",
                    marginTop: 16,
                    borderRadius: 12,
                    border: `1px solid ${profApproved ? "#7c3aed" : "#e7eaf0"}`,
                    background: profApproved ? "#f6f2fe" : "#fbfcfd",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={profApproved}
                    onChange={(e) => setProfApproved(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 1, accentColor: "#7c3aed", flexShrink: 0, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f1729", lineHeight: 1.45 }}>
                    I've reviewed my profile and confirm my name, Zoom info, and phone number are correct.
                  </span>
                </label>
                {profError && <div style={{ marginTop: 10, fontSize: 12.5, color: "#c0392b", fontWeight: 600 }}>{profError}</div>}
              </>
            )}
          </div>
        )}

        {/* Progress + controls */}
        <div style={{ padding: "14px 22px 20px" }}>
          {step === "video" && (
          <div style={{ height: 8, borderRadius: 999, background: "#eef1f5", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: finished ? "linear-gradient(90deg,#059669,#22c55e)" : "linear-gradient(90deg,#7c3aed,#6366f1)",
                transition: "width .2s linear",
              }}
            />
          </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 12 }}>
            {(() => {
              const btnDisabled =
                step === "ack" ? !acksComplete : step === "profile" ? !profileComplete || profSaving : mandatory && !finished;
              const statusText =
                step === "ack"
                  ? acksComplete
                    ? "Thanks — one more step."
                    : "Check both boxes to continue."
                  : step === "profile"
                  ? profSaving
                    ? "Saving your profile…"
                    : profileComplete
                    ? "Looks good — approve to finish."
                    : "Add first/last name, phone + Zoom, then approve."
                  : finished
                  ? "Complete — nice work!"
                  : started
                  ? `Watching… ${Math.floor(pct)}%`
                  : mandatory
                  ? "Press play to begin. You can't skip ahead."
                  : "Press play to watch the intro.";
              const statusGood = step === "ack" ? acksComplete : step === "profile" ? profileComplete : finished;
              const btnLabel =
                step === "ack"
                  ? "I understand — Continue"
                  : step === "profile"
                  ? profSaving
                    ? "Saving…"
                    : "Approve & Continue"
                  : mandatory
                  ? finished
                    ? requiresAck
                      ? "Continue"
                      : "Continue to app"
                    : "Watch to continue"
                  : "Close";
              return (
                <>
                  <div style={{ fontSize: 12.5, color: statusGood ? "#059669" : "#8b94a7", fontWeight: 600 }}>{statusText}</div>
                  <button
                    type="button"
                    onClick={proceed}
                    disabled={btnDisabled}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 11,
                      border: "none",
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: btnDisabled ? "not-allowed" : "pointer",
                      color: "#fff",
                      background: btnDisabled ? "#c7cede" : "linear-gradient(135deg,#7c3aed,#6366f1)",
                      boxShadow: btnDisabled ? "none" : "0 10px 24px rgba(124,58,237,.35)",
                    }}
                  >
                    {btnLabel}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Re-watch link/button for the main page. */
export function GettingStartedButton({
  variant = "sidebar",
  className,
  label = "Getting Started",
}: {
  variant?: "sidebar" | "link" | "plain";
  className?: string;
  label?: string;
}) {
  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={openGettingStarted}
        className={className}
        style={{
          background: "none",
          border: "none",
          color: "#7c3aed",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          textDecoration: "underline",
          padding: 0,
        }}
      >
        ▶ {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openGettingStarted}
      title="Re-watch the Getting Started video"
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 10px",
        borderRadius: 11,
        border: "1px solid #e7eaf0",
        background: "#fff",
        color: "#56607a",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "linear-gradient(135deg,#7c3aed,#6366f1)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        ▶
      </span>
      {label}
    </button>
  );
}

export default GettingStartedVideoGate;
