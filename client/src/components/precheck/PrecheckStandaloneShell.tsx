import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Loader2, Send, Shield, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isAoPrecheckStandalone } from "@/lib/aoprecheck-standalone";
import { PrecheckManagerModal } from "@/components/precheck/PrecheckManagerModal";

export type PrecheckSidebarSession = {
  id: string;
  sessionId?: string | null;
  clientName: string;
  clientPhone?: string | null;
  status?: string;
  method?: string;
  createdAt?: string | null;
  transmitStatus?: string | null;
};

type ConfirmAction = "transmit" | "archive";

type Props = {
  children: React.ReactNode;
  pendingSessions: PrecheckSidebarSession[];
  completedSessions: PrecheckSidebarSession[];
  isLoading?: boolean;
  onSelectSession?: (session: PrecheckSidebarSession) => void;
  onTransmitSession?: (session: PrecheckSidebarSession) => void;
  onArchiveSession?: (session: PrecheckSidebarSession) => void;
  actionBusy?: boolean;
  userInitials?: string;
  managerEmail?: string;
  onSignOut?: () => void;
};

function PendingSessionRow({
  session,
  onOpen,
  onTransmit,
  onArchive,
  disabled,
}: {
  session: PrecheckSidebarSession;
  onOpen: () => void;
  onTransmit: () => void;
  onArchive: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-1 mb-1 rounded-xl border border-transparent hover:border-[#e7eaf0] hover:bg-[#fbfcfd]">
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 bg-gradient-to-br from-violet-600 to-indigo-500">
          {(session.clientName || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate text-[#0f1729]">{session.clientName}</div>
          <div className="text-xs text-[#8b94a7] truncate">{session.clientPhone || session.method || "—"}</div>
        </div>
        <span className="w-2 h-2 rounded-full shrink-0 bg-amber-500" />
      </button>
      <div className="flex gap-2 px-2 pb-2">
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onTransmit();
          }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[9px] text-[11px] font-semibold border border-[#dcc9f5] bg-[#f4eafe] text-[#7c2fce] hover:brightness-[1.02] disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
          Transmit
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[9px] text-[11px] font-semibold border border-[#e7eaf0] bg-white text-[#56607a] hover:border-violet-400 hover:text-[#7c2fce] disabled:opacity-50"
        >
          <Archive className="w-3 h-3" />
          Archive
        </button>
      </div>
    </div>
  );
}

function CompletedSessionRow({
  session,
  onClick,
}: {
  session: PrecheckSidebarSession;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#fbfcfd] text-left transition-colors"
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-600">
        {(session.clientName || "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate text-[#0f1729]">{session.clientName}</div>
        <div className="text-xs text-[#8b94a7] truncate">{session.clientPhone || session.method || "—"}</div>
      </div>
      <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
    </button>
  );
}

/** Full chrome when not embedded in /app iframe; passthrough when parent shell owns header/drawer. */
export function PrecheckStandaloneShell({
  children,
  pendingSessions,
  completedSessions,
  isLoading,
  onSelectSession,
  onTransmitSession,
  onArchiveSession,
  actionBusy,
  userInitials = "—",
  managerEmail,
  onSignOut,
}: Props) {
  const inAppFrame = typeof window !== "undefined" && window.self !== window.top;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; session: PrecheckSidebarSession } | null>(null);

  const filter = useCallback(
    (list: PrecheckSidebarSession[]) => {
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter(
        (s) =>
          s.clientName?.toLowerCase().includes(q) ||
          String(s.sessionId || s.id).toLowerCase().includes(q) ||
          s.clientPhone?.toLowerCase().includes(q),
      );
    },
    [search],
  );

  const filteredPending = useMemo(() => filter(pendingSessions), [filter, pendingSessions]);
  const filteredCompleted = useMemo(() => filter(completedSessions), [filter, completedSessions]);

  useEffect(() => {
    if (!inAppFrame) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "aoprecheck-open-session" && ev.data.sessionId) {
        const all = [...pendingSessions, ...completedSessions];
        const hit = all.find((s) => String(s.sessionId || s.id) === String(ev.data.sessionId));
        if (hit && onSelectSession) onSelectSession(hit);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [inAppFrame, pendingSessions, completedSessions, onSelectSession]);

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.action === "transmit") onTransmitSession?.(confirm.session);
    else onArchiveSession?.(confirm.session);
    setConfirm(null);
  };

  if (!isAoPrecheckStandalone()) {
    return <>{children}</>;
  }

  if (inAppFrame) {
    return <div className="precheck-stage min-h-full bg-[#f6f7f9] text-[#0f1729] font-[Inter,system-ui,sans-serif]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#0f1729] font-[Inter,system-ui,sans-serif] flex flex-col">
      <header className="sticky top-0 z-30 h-[62px] shrink-0 bg-white border-b border-[#e7eaf0] px-6 flex items-center gap-3.5">
        <button
          type="button"
          aria-label="Open sessions menu"
          onClick={() => setDrawerOpen(true)}
          className="w-10 h-10 rounded-[11px] border border-[#e7eaf0] bg-white grid place-items-center text-[#56607a] hover:bg-[#fbfcfd] hover:border-[#aeb6c6]"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
          AO Precheck
        </h1>
        <span className="text-xs font-semibold text-[#7c2fce] bg-[#f4eafe] px-2.5 py-1 rounded-full">Verification</span>
        <div className="flex-1" />
        <div className="relative">
          <button
            type="button"
            id="precheck-profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[#e7eaf0] bg-white text-[#56607a] font-semibold text-[13px] hover:border-violet-500"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-indigo-500 text-white text-[11px] font-semibold grid place-items-center">
              {userInitials}
            </span>
            Profile
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-white border border-[#e7eaf0] rounded-xl shadow-lg p-2 z-50">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-[#fbfcfd]"
                onClick={() => {
                  setProfileOpen(false);
                  onSignOut?.();
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        className={`fixed inset-0 bg-[rgba(15,23,41,0.32)] z-[60] transition-opacity ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        className={`fixed top-0 left-0 h-full w-[340px] bg-white border-r border-[#e7eaf0] shadow-xl z-[61] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="text-lg font-extrabold flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            My prechecks
            <span className="ml-auto text-xs font-bold text-[#8b94a7] bg-[#fbfcfd] border border-[#e7eaf0] rounded-full px-2.5 py-0.5">
              {pendingSessions.length + completedSessions.length}
            </span>
          </div>
        </div>
        <div className="mx-5 mb-3 flex items-center gap-2 bg-[#fbfcfd] border border-[#e7eaf0] rounded-[11px] px-3 py-2.5">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8b94a7" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[#8b94a7] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-[#8b94a7]">
                Pending · {filteredPending.length}
              </div>
              {filteredPending.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-[#aeb6c6]">No pending prechecks</p>
              ) : (
                filteredPending.map((s) => (
                  <PendingSessionRow
                    key={s.id}
                    session={s}
                    disabled={actionBusy}
                    onOpen={() => {
                      onSelectSession?.(s);
                      setDrawerOpen(false);
                    }}
                    onTransmit={() => setConfirm({ action: "transmit", session: s })}
                    onArchive={() => setConfirm({ action: "archive", session: s })}
                  />
                ))
              )}
              <div className="px-2 py-2 mt-2 text-[11px] font-bold uppercase tracking-wide text-[#8b94a7] border-t border-[#eef1f5] pt-3">
                Completed · {filteredCompleted.length}
              </div>
              {filteredCompleted.length === 0 ? (
                <p className="px-2 pb-3 text-sm text-[#aeb6c6]">No completed prechecks</p>
              ) : (
                filteredCompleted.map((s) => (
                  <CompletedSessionRow
                    key={s.id}
                    session={s}
                    onClick={() => {
                      onSelectSession?.(s);
                      setDrawerOpen(false);
                    }}
                  />
                ))
              )}
            </>
          )}
        </div>
        <div className="border-t border-[#eef1f5] p-3 space-y-1">
          <button
            type="button"
            onClick={() => setManagerOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[11px] text-sm font-medium text-[#56607a] hover:bg-[#fbfcfd] hover:text-[#0f1729] text-left"
          >
            <Shield className="w-5 h-5 text-violet-600" />
            Precheck Manager
          </button>
        </div>
      </aside>

      <PrecheckManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        managerEmail={managerEmail}
      />

      <main className="flex-1 min-h-0">{children}</main>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "transmit" ? "Transmit to Management?" : "Archive precheck?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "transmit" ? (
                <>
                  Send <strong>{confirm.session.clientName}</strong> to AO Precheck Management? This will move the
                  session to Completed.
                </>
              ) : (
                <>
                  Archive <strong>{confirm?.session.clientName}</strong> as training? It will be removed from your
                  pending list and scheduled for deletion in 24 hours.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runConfirm();
              }}
              disabled={actionBusy}
              className={
                confirm?.action === "transmit"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-500 hover:brightness-105"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {actionBusy ? "Working…" : confirm?.action === "transmit" ? "Transmit" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Stage layout + workflow card styling for continuity with /app shell */
export function PrecheckStage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const inFrame = typeof window !== "undefined" && window.self !== window.top;
  return (
    <div
      className={`${inFrame ? "min-h-full" : "min-h-[calc(100vh-62px)]"} md:min-h-full grid place-items-center px-6 py-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function PrecheckWorkflowPanel({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <PrecheckStage className="items-start !py-4 !px-4 sm:!px-6">
      <div className="w-full max-w-6xl min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-[11px] border border-[#e7eaf0] bg-white text-sm font-semibold text-[#56607a] hover:border-violet-500 hover:text-[#7c2fce]"
        >
          ← Back to dashboard
        </button>
        <div className="bg-white border border-[#e7eaf0] rounded-2xl shadow-sm p-4 sm:p-6 md:p-8 precheck-workflow-panel overflow-hidden min-w-0">
          {children}
        </div>
      </div>
    </PrecheckStage>
  );
}
