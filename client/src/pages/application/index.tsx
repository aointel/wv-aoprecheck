import { useEffect, useRef, useState } from "react";
import SeniorComboWizard from "./SeniorComboWizard";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface PendingInject {
  inject: Record<string, string>;
  presentation_guid?: string;
}

export default function ApplicationPage() {
  const { authState } = useAuth();
  const userEmail = authState?.user?.email || undefined;
  const [injectData, setInjectData] = useState<Record<string, string> | null>(null);
  const [savedState, setSavedState] = useState<Record<string, unknown> | null>(null);
  const [savedStep, setSavedStep] = useState<string | null>(null);
  const [presentationGuid, setPresentationGuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedGuidRef = useRef<string | null>(null);
  const lastPendingSignatureRef = useRef<string>("");
  const stopPollingRef = useRef(false);

  // The app shell sets global overflow hidden. Force scroll in standalone AOI window.
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const prevRootOverflow = root?.style.overflow ?? "";
    const prevRootHeight = root?.style.height ?? "";
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;

    document.documentElement.style.setProperty("overflow", "auto", "important");
    document.body.style.setProperty("overflow", "auto", "important");
    document.documentElement.style.overscrollBehavior = "auto";
    document.body.style.overscrollBehavior = "auto";
    if (root) {
      root.style.setProperty("overflow", "auto", "important");
      root.style.height = "auto";
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const loadSavedForGuid = async (guid: string | null) => {
      if (!guid) {
        setSavedState(null);
        setSavedStep(null);
        return;
      }
      try {
        const savedRes = await apiRequest(
          "GET",
          `/api/application/state?guid=${encodeURIComponent(guid)}&_=${Date.now()}`,
          undefined,
          userEmail,
        );
        const saved = await savedRes.json();
        if (!active) return;
        if (saved?.state) {
          setSavedState(saved.state);
          setSavedStep(saved.step || null);
        } else {
          setSavedState(null);
          setSavedStep(null);
        }
      } catch {
        if (!active) return;
        setSavedState(null);
        setSavedStep(null);
      }
    };

    const pullPending = async () => {
      try {
        const pendingRes = await apiRequest(
          "GET",
          `/api/hppro/eapp-pending?_=${Date.now()}`,
          undefined,
          userEmail,
        );
        const pending = await pendingRes.json();
        if (!active) return;
        const inj = (pending as any)?.pending?.inject || null;
        const guid = (pending as any)?.pending?.presentation_guid || null;
        const signature = `${guid || ""}|${inj ? JSON.stringify(inj) : ""}`;
        if (signature && signature === lastPendingSignatureRef.current) return;
        lastPendingSignatureRef.current = signature;

        if (inj) {
          setInjectData(inj);
          // Stop polling immediately once payload arrives to avoid focus/cursor jumps.
          stopPollingRef.current = true;
          if (timer != null) {
            window.clearInterval(timer);
            timer = null;
          }
        }
        if (guid) {
          setPresentationGuid(guid);
          if (loadedGuidRef.current !== guid) {
            loadedGuidRef.current = guid;
            await loadSavedForGuid(guid);
          }
        }
      } catch {
        // Keep quiet; caller handles retries
      }
    };

    timer = window.setInterval(() => {
      if (stopPollingRef.current) return;
      void pullPending();
    }, 2000);

    const loadInitial = async () => {
      await pullPending();
      if (!active) return;
      setLoading(false);
    };
    void loadInitial();

    return () => {
      active = false;
      if (timer != null) window.clearInterval(timer);
    };
  }, [userEmail]);

  if (loading) {
    return (
      <div style={{ height: "100vh", overflowY: "auto", overflowX: "hidden" }}>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-cyan-400 text-lg font-semibold animate-pulse">Loading application data…</div>
        </div>
      </div>
    );
  }

  const inj = injectData || {};

  // Names from inject payload (flat keys set by hppro-eapp-bridge)
  const primaryFirst = inj.firstName || "";
  const primaryLast  = inj.lastName  || "";
  const primaryName  = [primaryFirst, primaryLast].filter(Boolean).join(" ").toUpperCase() || "PRIMARY INSURED";

  const spouseFirst = inj.spouseFirstName || "";
  const spouseLast  = inj.spouseLastName  || "";
  const spouseName  = [spouseFirst, spouseLast].filter(Boolean).join(" ").toUpperCase() || "";

  const hasSpouse    = (inj.spouseFirstName || "").trim().length > 0;
  const spouseHasLife = inj.spouseLife1GroupId ? inj.spouseLife1GroupId.length > 0 : inj.hasSpouseLife === "True";

  const city  = inj.city  || "";
  const state = inj.state || "";

  return (
    <div style={{ height: "100vh", overflowY: "auto", overflowX: "hidden" }}>
      <SeniorComboWizard
        primaryName={primaryName}
        spouseName={spouseName}
        hasSpouse={hasSpouse}
        spouseHasLife={spouseHasLife}
        city={city}
        state={state}
        inject={inj}
        savedState={savedState}
        savedStep={savedStep}
        presentationGuid={presentationGuid}
      />
    </div>
  );
}
