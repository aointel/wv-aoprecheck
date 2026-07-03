import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

const SENIOR_MQ = [
  { key: "MQRejectedByAIL", text: "Has the proposed insured ever been rejected for life insurance by American Income Life?" },
  { key: "MQSmokeCigarettesTobacco", text: "Has the proposed insured used tobacco in the past 12 months?" },
  { key: "MQTerminalIllness", text: "Has the proposed insured been advised that they have a terminal illness?" },
  { key: "MQOrganTransplant", text: "Has the proposed insured been advised to have or had a heart, lung, liver or bone marrow transplant?" },
  { key: "MQlTreated4ALS", text: "Has the proposed insured been diagnosed or treated for ALS, Alzheimer's disease, or senile dementia?" },
  { key: "MQKidneyDisease", text: "Has the proposed insured been diagnosed with chronic kidney failure including kidney dialysis?" },
  { key: "MQAmputationCausedByDisease", text: "Has the proposed insured had an amputation caused by disease?" },
  { key: "MQAIDS", text: "Has the proposed insured been diagnosed with or tested positive for HIV/AIDS?" },
  { key: "MQConfined2NursingFacility", text: "Is the proposed insured currently confined to a nursing facility or receiving home health care?" },
  { key: "MQReceivingTreatment", text: "Is the proposed insured currently receiving treatment, medication or therapy for any illness or injury?" },
  { key: "MQ12MonthsLostWeight", text: "Has the proposed insured lost 10 or more pounds unintentionally in the last 12 months?" },
  { key: "MQArthritisBackKnee", text: "In the last 10 years, has the proposed insured had arthritis or any injury to back, knees or joints?" },
  { key: "MQTreatment4HodgkinsLeukemiaMalignantCancer", text: "In the last 10 years, has the proposed insured been diagnosed/treated for cancer, tumor or unexplained masses?" },
  { key: "MQDrugAlcoholAbuse", text: "Has the proposed insured been treated for alcoholism or drug abuse?" },
] as const;

interface PersonDoctor {
  name: string;
  npi: string;
  address: string;
  phone: string;
  dateLastSeen: string;
  medicalRecordsId: string;
  isVA: boolean;
}

interface ReplacementInfo {
  applies: boolean;
  amountOfInsurance: string;
  insuredType: string;
  company: string;
  benefit: string;
}

interface PersonDetails {
  birthPlace: string;
  isUSResident: boolean | null;
  dlNumber: string;
  dlState: string;
  ssn: string;
  cellPhone: string;
  bestTimeToCall: string;
  iSaw: boolean;
  doctor: PersonDoctor;
  occupation: string;
  employer: string;
  replacement: ReplacementInfo;
}

interface PersonBuild {
  heightFt: number;
  heightIn: number;
  weightLbs: number;
  tobacco: boolean;
  tobaccoDate: string;
  mq: Record<string, boolean>;
}

interface RxEntry {
  name: string;
  dosage: string;
  doctor: string;
  doctorAddress: string;
  doctorPhone: string;
  reason: string;
  duration: string;
}

interface AppMeta {
  remarks: string;
  mailTo: "Agency" | "Policyholder";
}

interface SeniorComboState {
  primary: PersonBuild;
  spouse: PersonBuild;
  primaryDetails: PersonDetails;
  spouseDetails: PersonDetails;
  hasSpouse: boolean;
  spouseHasLife: boolean;
  primaryName: string;
  spouseName: string;
  primaryCity: string;
  primaryState: string;
  primaryRx: RxEntry[];
  spouseRx: RxEntry[];
  primaryBene1: { name: string; relationship: string };
  primaryBene2: { name: string; relationship: string };
  spouseBene1: { name: string; relationship: string };
  spouseBene2: { name: string; relationship: string };
  banking: {
    bankName: string;
    routing: string;
    account: string;
    accountType: "Checking" | "Savings";
    drawDay: number;
    holderName: string;
  };
  appMeta: AppMeta;
}

interface WizardProps {
  primaryName: string;
  spouseName: string;
  hasSpouse: boolean;
  spouseHasLife: boolean;
  city?: string;
  state?: string;
  inject?: Record<string, string>;
  savedState?: Record<string, unknown> | null;
  savedStep?: string | null;
  presentationGuid?: string | null;
}

function defaultDoctor(): PersonDoctor {
  return { name: "", npi: "", address: "", phone: "", dateLastSeen: "", medicalRecordsId: "", isVA: false };
}

function defaultReplacement(): ReplacementInfo {
  return { applies: false, amountOfInsurance: "", insuredType: "", company: "", benefit: "" };
}

function defaultDetails(): PersonDetails {
  return {
    birthPlace: "",
    isUSResident: true,
    dlNumber: "",
    dlState: "",
    ssn: "",
    cellPhone: "",
    bestTimeToCall: "",
    iSaw: true,
    doctor: defaultDoctor(),
    occupation: "",
    employer: "",
    replacement: defaultReplacement(),
  };
}

function defaultBuild(): PersonBuild {
  return { heightFt: 5, heightIn: 4, weightLbs: 0, tobacco: false, tobaccoDate: "", mq: {} };
}

function defaultRx(): RxEntry {
  return { name: "", dosage: "", doctor: "", doctorAddress: "", doctorPhone: "", reason: "", duration: "" };
}

function defaultAppMeta(): AppMeta {
  return { remarks: "", mailTo: "Policyholder" };
}

function sanitizeIdentityField(v: string): string {
  const s = (v || "").trim();
  return s.includes("@") ? "" : s;
}

function sanitizeWizardState(state: SeniorComboState): SeniorComboState {
  return {
    ...state,
    primaryDetails: {
      ...state.primaryDetails,
      dlNumber: sanitizeIdentityField(state.primaryDetails.dlNumber),
    },
    spouseDetails: {
      ...state.spouseDetails,
      dlNumber: sanitizeIdentityField(state.spouseDetails.dlNumber),
    },
    primaryBene1: { ...state.primaryBene1, name: sanitizeIdentityField(state.primaryBene1.name) },
    primaryBene2: { ...state.primaryBene2, name: sanitizeIdentityField(state.primaryBene2.name) },
    spouseBene1: { ...state.spouseBene1, name: sanitizeIdentityField(state.spouseBene1.name) },
    spouseBene2: { ...state.spouseBene2, name: sanitizeIdentityField(state.spouseBene2.name) },
    banking: { ...state.banking, holderName: sanitizeIdentityField(state.banking.holderName) },
  };
}

function normalizeMq(mq: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const q of SENIOR_MQ) out[q.key] = Boolean(mq[q.key]);
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
    <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h2 className="text-cyan-400 font-bold text-sm uppercase tracking-wide mb-3">{title}</h2>
        {children}
    </section>
  );
}

function SubAccordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 bg-slate-700/40">
        {title}
      </summary>
      <div className="p-3">{children}</div>
    </details>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
              <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-700 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
    />
  );
}

function RxEditor({
  title,
  entries,
  onChange,
}: {
  title: string;
  entries: RxEntry[];
  onChange: (entries: RxEntry[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-200 font-semibold text-sm">{title}</p>
              <button
                type="button"
          onClick={() => onChange([...entries, defaultRx()])}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg"
        >
          + Add Medication
        </button>
      </div>
      {entries.length === 0 && <p className="text-slate-400 text-xs">No medications added.</p>}
      {entries.map((rx, idx) => (
        <div key={`${title}-${idx}`} className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-700/40 rounded-lg p-3 border border-slate-700">
          <TextField value={rx.name} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, name: v } : e)))} placeholder="Medication" />
          <TextField value={rx.dosage} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, dosage: v } : e)))} placeholder="Dosage" />
          <TextField value={rx.reason} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, reason: v } : e)))} placeholder="Reason" />
          <TextField value={rx.duration} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, duration: v } : e)))} placeholder="Duration" />
          <TextField value={rx.doctor} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, doctor: v } : e)))} placeholder="Doctor name" />
          <TextField value={rx.doctorPhone} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, doctorPhone: v } : e)))} placeholder="Doctor phone" />
          <div className="md:col-span-2">
            <TextField value={rx.doctorAddress} onChange={(v) => onChange(entries.map((e, i) => (i === idx ? { ...e, doctorAddress: v } : e)))} placeholder="Doctor address" />
    </div>
            <button
                type="button"
            onClick={() => onChange(entries.filter((_, i) => i !== idx))}
            className="md:col-span-2 px-3 py-2 bg-red-700/80 hover:bg-red-700 text-white text-xs rounded-lg"
              >
            Remove Medication
              </button>
          </div>
      ))}
    </div>
  );
}

export default function SeniorComboWizard({
  primaryName,
  spouseName,
  hasSpouse,
  spouseHasLife,
  city = "",
  state: clientState = "",
  inject = {},
  savedState,
  savedStep,
  presentationGuid,
}: WizardProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; injected: boolean; error?: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const lastHydrationSignature = useRef<string>("");

  const freshState = useMemo<SeniorComboState>(() => {
    const prefill = (who: "primary" | "spouse"): PersonDetails => {
    const d = defaultDetails();
      if (who === "primary") {
        if (inject.primaryBirthPlace) d.birthPlace = inject.primaryBirthPlace;
        if (inject.primaryUSResident === "False") d.isUSResident = false;
        if (inject.primarySSN) d.ssn = inject.primarySSN;
        if (inject.occupation) {
          d.occupation = inject.occupation;
          d.employer = inject.occupation.toLowerCase().includes("retir") ? "Retired" : "";
        }
    } else {
        if (inject.spouseBirthPlace) d.birthPlace = inject.spouseBirthPlace;
        if (inject.spouseUSResident === "False") d.isUSResident = false;
        if (inject.spouseSSN) d.ssn = inject.spouseSSN;
    }
    return d;
    };

    return {
      primary: { ...defaultBuild(), tobacco: inject.insured1Tobacco === "True" },
      spouse: { ...defaultBuild(), tobacco: inject.spouse1Tobacco === "True" },
      primaryDetails: prefill("primary"),
      spouseDetails: prefill("spouse"),
    hasSpouse,
    spouseHasLife,
    primaryName,
    spouseName,
    primaryCity: city,
    primaryState: clientState,
    primaryRx: [],
    spouseRx: [],
      primaryBene1: { name: spouseName || "", relationship: spouseName ? "Spouse" : "" },
      primaryBene2: { name: "", relationship: "" },
      spouseBene1: { name: primaryName || "", relationship: primaryName ? "Spouse" : "" },
      spouseBene2: { name: "", relationship: "" },
    banking: {
        bankName: "",
        routing: inject.routingNumber || "",
        account: inject.accountNumber || "",
        accountType: (inject.accountType as "Checking" | "Savings") || "Checking",
        drawDay: parseInt(inject.drawDay || "1", 10) || 1,
        holderName: primaryName || "",
    },
    appMeta: defaultAppMeta(),
  };
  }, [inject, hasSpouse, spouseHasLife, primaryName, spouseName, city, clientState]);

  const mergedState = useMemo<SeniorComboState>(() => {
    if (!savedState) return freshState;
    const s = savedState as Partial<SeniorComboState>;
    return sanitizeWizardState({
      ...freshState,
      ...s,
      primary: { ...freshState.primary, ...(s.primary || {}) },
      spouse: { ...freshState.spouse, ...(s.spouse || {}) },
      primaryDetails: {
        ...freshState.primaryDetails,
        ...(s.primaryDetails || {}),
        doctor: { ...freshState.primaryDetails.doctor, ...(s.primaryDetails?.doctor || {}) },
        replacement: { ...freshState.primaryDetails.replacement, ...(s.primaryDetails?.replacement || {}) },
      },
      spouseDetails: {
        ...freshState.spouseDetails,
        ...(s.spouseDetails || {}),
        doctor: { ...freshState.spouseDetails.doctor, ...(s.spouseDetails?.doctor || {}) },
        replacement: { ...freshState.spouseDetails.replacement, ...(s.spouseDetails?.replacement || {}) },
      },
      primaryRx: Array.isArray(s.primaryRx) ? (s.primaryRx as RxEntry[]) : freshState.primaryRx,
      spouseRx: Array.isArray(s.spouseRx) ? (s.spouseRx as RxEntry[]) : freshState.spouseRx,
      primaryBene1: { ...freshState.primaryBene1, ...(s.primaryBene1 || {}) },
      primaryBene2: { ...freshState.primaryBene2, ...(s.primaryBene2 || {}) },
      spouseBene1: { ...freshState.spouseBene1, ...(s.spouseBene1 || {}) },
      spouseBene2: { ...freshState.spouseBene2, ...(s.spouseBene2 || {}) },
      banking: { ...freshState.banking, ...(s.banking || {}) },
      appMeta: { ...freshState.appMeta, ...(s.appMeta || {}) },
    });
  }, [savedState, freshState]);

  const [state, setState] = useState<SeniorComboState>(mergedState);

  useEffect(() => {
    const signature = [
      presentationGuid || "",
      primaryName || "",
      spouseName || "",
      city || "",
      clientState || "",
      inject.firstName || "",
      inject.lastName || "",
      inject.state || "",
      inject.dobMonth || "",
      inject.dobDay || "",
      inject.dobYear || "",
      savedStep || "",
    ].join("|");

    if (!signature || signature === lastHydrationSignature.current || isDirty) return;
    lastHydrationSignature.current = signature;
    setState(mergedState);
  }, [presentationGuid, primaryName, spouseName, city, clientState, inject, savedStep, isDirty, mergedState]);

  function patch(updates: Partial<SeniorComboState>) {
    setIsDirty(true);
    setState((prev) => sanitizeWizardState({ ...prev, ...updates }));
  }

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const body: Record<string, unknown> = { wizard_state: state, step: "setup" };
      if (presentationGuid) body.presentation_guid = presentationGuid;
      apiRequest("POST", "/api/application/state", body).catch(() => {});
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, presentationGuid]);

  const syncIssues: string[] = [];
  if (state.primary.weightLbs <= 0) syncIssues.push(`Weight required for ${state.primaryName || "primary"}`);
  if (state.hasSpouse && state.spouseHasLife && state.spouse.weightLbs <= 0) syncIssues.push(`Weight required for ${state.spouseName || "spouse"}`);
  if (!state.primaryBene1.name || !state.primaryBene1.relationship) syncIssues.push(`Primary beneficiary required for ${state.primaryName || "primary"}`);
  if (!state.primaryBene2.name || !state.primaryBene2.relationship) syncIssues.push(`Contingent beneficiary required for ${state.primaryName || "primary"}`);
  if (state.hasSpouse && state.spouseHasLife) {
    if (!state.spouseBene1.name || !state.spouseBene1.relationship) syncIssues.push(`Primary beneficiary required for ${state.spouseName || "spouse"}`);
    if (!state.spouseBene2.name || !state.spouseBene2.relationship) syncIssues.push(`Contingent beneficiary required for ${state.spouseName || "spouse"}`);
  }
  const canSync = syncIssues.length === 0;

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const body = {
        primaryMQ: normalizeMq(state.primary.mq),
        spouseMQ: normalizeMq(state.spouse.mq),
        primaryHeightInches: state.primary.heightFt * 12 + state.primary.heightIn,
        primaryWeight: state.primary.weightLbs,
        primaryTobacco: state.primary.tobacco,
        spouseHeightInches: state.spouse.heightFt * 12 + state.spouse.heightIn,
        spouseWeight: state.spouse.weightLbs,
        spouseTobacco: state.spouse.tobacco,
        primaryRx: state.primaryRx,
        spouseRx: state.spouseRx,
        primaryBene1: state.primaryBene1,
        primaryBene2: state.primaryBene2,
        spouseBene1: state.spouseBene1,
        spouseBene2: state.spouseBene2,
        banking: state.banking,
        primaryBirthPlace: state.primaryDetails.birthPlace,
        primaryUSResident: state.primaryDetails.isUSResident,
        primaryDL: state.primaryDetails.dlNumber,
        primaryDLState: state.primaryDetails.dlState,
        primarySSN: state.primaryDetails.ssn,
        primaryDetails: state.primaryDetails,
        spouseBirthPlace: state.spouseDetails.birthPlace,
        spouseUSResident: state.spouseDetails.isUSResident,
        spouseDL: state.spouseDetails.dlNumber,
        spouseDLState: state.spouseDetails.dlState,
        spouseSSN: state.spouseDetails.ssn,
        spouseDetails: state.spouseDetails,
        primaryISaw: state.primaryDetails.iSaw,
        spouseISaw: state.spouseDetails.iSaw,
        primaryCellPhone: state.primaryDetails.cellPhone,
        spouseCellPhone: state.spouseDetails.cellPhone,
        primaryBestTimeToCall: state.primaryDetails.bestTimeToCall,
        spouseBestTimeToCall: state.spouseDetails.bestTimeToCall,
        remarks: state.appMeta.remarks,
        mailTo: state.appMeta.mailTo,
      };

      const res = await apiRequest("POST", "/api/application/senior-combo", body);
      const json = await res.json();
      setSyncResult({ ok: json.ok, injected: json.injected, error: json.error });
    } catch (e: any) {
      setSyncResult({ ok: false, injected: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  }

  const showSpouseLifeSections = state.hasSpouse && state.spouseHasLife;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-cyan-400">Senior Combo Application</h1>
            <p className="text-slate-400 text-xs">Rebuilt simple layout - all required fields preserved</p>
          </div>
          <span className="text-slate-400 text-xs bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5">Auto-saving</span>
        </div>

        <Section title="1. Who's Applying">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 text-xs mb-1 block">Primary Name</label>
              <TextField value={state.primaryName} onChange={(v) => patch({ primaryName: v.toUpperCase() })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked readOnly className="h-4 w-4 accent-cyan-500" />
                Primary is applying for life
              </label>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={state.hasSpouse}
                  onChange={(e) => patch({ hasSpouse: e.target.checked, spouseHasLife: e.target.checked })}
                  className="h-4 w-4 accent-cyan-500"
                />
                Spouse on application
              </label>
              {state.hasSpouse && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={state.spouseHasLife}
                      onChange={(e) => patch({ spouseHasLife: e.target.checked })}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    Spouse applying for life
                  </label>
                  <div className="w-full md:w-96">
                    <label className="text-slate-300 text-xs mb-1 block">Spouse Name</label>
                    <TextField value={state.spouseName} onChange={(v) => patch({ spouseName: v.toUpperCase() })} />
                  </div>
                </>
              )}
            </div>
          </div>
        </Section>

        <Section title="2. Build and Basic Info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["primary", "spouse"] as const).filter((who) => who === "primary" || state.hasSpouse).map((who) => {
              const person = who === "primary" ? state.primary : state.spouse;
              const details = who === "primary" ? state.primaryDetails : state.spouseDetails;
              const name = who === "primary" ? state.primaryName || "Primary" : state.spouseName || "Spouse";
              const setBuild = (next: Partial<PersonBuild>) =>
                who === "primary" ? patch({ primary: { ...state.primary, ...next } }) : patch({ spouse: { ...state.spouse, ...next } });
              const setDetails = (next: Partial<PersonDetails>) =>
                who === "primary"
                  ? patch({ primaryDetails: { ...state.primaryDetails, ...next } })
                  : patch({ spouseDetails: { ...state.spouseDetails, ...next } });

              return (
                <div key={who} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3 space-y-2">
                  <p className="text-cyan-300 font-semibold text-sm">{name}</p>
                  <SubAccordion title={`${name} - Build`} defaultOpen>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <TextField value={details.birthPlace} onChange={(v) => setDetails({ birthPlace: v })} placeholder="Birth place" />
                      <TextField value={person.heightFt} onChange={(v) => setBuild({ heightFt: Number(v) || 0 })} placeholder="Height ft" type="number" />
                      <TextField value={person.heightIn} onChange={(v) => setBuild({ heightIn: Number(v) || 0 })} placeholder="Height in" type="number" />
                      <TextField value={person.weightLbs || ""} onChange={(v) => setBuild({ weightLbs: Number(v) || 0 })} placeholder="Weight lbs" type="number" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={person.tobacco}
                          onChange={(e) => setBuild({ tobacco: e.target.checked })}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        Tobacco
                      </label>
                      {person.tobacco && (
                        <div className="w-56">
                          <TextField value={person.tobaccoDate} onChange={(v) => setBuild({ tobaccoDate: v })} placeholder="Last tobacco date" />
                        </div>
                      )}
                    </div>
                  </SubAccordion>

                  <SubAccordion title={`${name} - Contact and Identity`} defaultOpen>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <TextField value={details.cellPhone} onChange={(v) => setDetails({ cellPhone: v })} placeholder="Cell phone" />
                      <TextField value={details.bestTimeToCall} onChange={(v) => setDetails({ bestTimeToCall: v })} placeholder="Best time to call" />
                      <TextField value={details.ssn} onChange={(v) => setDetails({ ssn: v.replace(/\D/g, "").slice(0, 9) })} placeholder="SSN (9 digits)" />
                      <TextField value={details.dlNumber} onChange={(v) => setDetails({ dlNumber: v })} placeholder="Driver license #" />
                      <TextField value={details.dlState} onChange={(v) => setDetails({ dlState: v.toUpperCase().slice(0, 2) })} placeholder="DL state" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(details.isUSResident)}
                          onChange={(e) => setDetails({ isUSResident: e.target.checked })}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        U.S. Resident
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={details.iSaw}
                          onChange={(e) => setDetails({ iSaw: e.target.checked })}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        Agent personally saw insured
                      </label>
                    </div>
                  </SubAccordion>

                  <SubAccordion title={`${name} - Occupation`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <TextField value={details.occupation} onChange={(v) => setDetails({ occupation: v })} placeholder="Occupation" />
                      <TextField value={details.employer} onChange={(v) => setDetails({ employer: v })} placeholder="Employer" />
                    </div>
                  </SubAccordion>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="3. Medical Questions">
          <div className="space-y-2">
            <div className="grid grid-cols-12 text-xs text-slate-400 border-b border-slate-700 pb-1">
              <div className="col-span-8">Question</div>
              <div className="col-span-2 text-center">{state.primaryName || "Primary"}</div>
              <div className="col-span-2 text-center">{showSpouseLifeSections ? state.spouseName || "Spouse" : "-"}</div>
            </div>
            {SENIOR_MQ.map((q) => (
              <div key={q.key} className="grid grid-cols-12 items-center gap-2 py-1.5 border-b border-slate-800">
                <div className="col-span-8 text-sm text-slate-200">{q.text}</div>
                <div className="col-span-2 flex justify-center">
                <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => patch({ primary: { ...state.primary, mq: { ...state.primary.mq, [q.key]: true } } })}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${
                        state.primary.mq[q.key] === true
                          ? "bg-green-600 border-green-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ primary: { ...state.primary, mq: { ...state.primary.mq, [q.key]: false } } })}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${
                        state.primary.mq[q.key] === false
                          ? "bg-red-600 border-red-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      No
                    </button>
                </div>
              </div>
                <div className="col-span-2 flex justify-center">
                  {showSpouseLifeSections ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => patch({ spouse: { ...state.spouse, mq: { ...state.spouse.mq, [q.key]: true } } })}
                        className={`px-2 py-1 rounded text-xs font-semibold border ${
                          state.spouse.mq[q.key] === true
                            ? "bg-green-600 border-green-500 text-white"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => patch({ spouse: { ...state.spouse, mq: { ...state.spouse.mq, [q.key]: false } } })}
                        className={`px-2 py-1 rounded text-xs font-semibold border ${
                          state.spouse.mq[q.key] === false
                            ? "bg-red-600 border-red-500 text-white"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        No
                      </button>
                </div>
                  ) : (
                    <span className="text-slate-600">-</span>
              )}
                </div>
            </div>
          ))}
          </div>
        </Section>

        <Section title="4. Doctor Info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["primary", "spouse"] as const).filter((who) => who === "primary" || state.hasSpouse).map((who) => {
              const details = who === "primary" ? state.primaryDetails : state.spouseDetails;
              const name = who === "primary" ? state.primaryName || "Primary" : state.spouseName || "Spouse";
              const setDetails = (next: Partial<PersonDetails>) =>
                who === "primary"
                  ? patch({ primaryDetails: { ...state.primaryDetails, ...next } })
                  : patch({ spouseDetails: { ...state.spouseDetails, ...next } });
              return (
                <div key={`doctor-${who}`} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3 space-y-2">
                  <p className="text-cyan-300 font-semibold text-sm">{name}</p>
                  <SubAccordion title={`${name} - Doctor Details`} defaultOpen>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <TextField value={details.doctor.name} onChange={(v) => setDetails({ doctor: { ...details.doctor, name: v } })} placeholder="Doctor name" />
                      <TextField value={details.doctor.npi} onChange={(v) => setDetails({ doctor: { ...details.doctor, npi: v } })} placeholder="Doctor NPI" />
                      <TextField value={details.doctor.phone} onChange={(v) => setDetails({ doctor: { ...details.doctor, phone: v } })} placeholder="Doctor phone" />
                      <TextField value={details.doctor.dateLastSeen} onChange={(v) => setDetails({ doctor: { ...details.doctor, dateLastSeen: v } })} placeholder="Date last seen (YYYY-MM-DD)" />
                      <div className="md:col-span-2">
                        <TextField value={details.doctor.address} onChange={(v) => setDetails({ doctor: { ...details.doctor, address: v } })} placeholder="Doctor address" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={details.doctor.isVA}
                          onChange={(e) => setDetails({ doctor: { ...details.doctor, isVA: e.target.checked } })}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        VA Doctor
                      </label>
                    </div>
                  </SubAccordion>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="5. Replacement and Beneficiaries">
          <div className="space-y-4">
            {(["primary", "spouse"] as const).filter((who) => who === "primary" || state.hasSpouse).map((who) => {
              const details = who === "primary" ? state.primaryDetails : state.spouseDetails;
              const setDetails = (next: Partial<PersonDetails>) =>
                who === "primary"
                  ? patch({ primaryDetails: { ...state.primaryDetails, ...next } })
                  : patch({ spouseDetails: { ...state.spouseDetails, ...next } });
              const title = who === "primary" ? state.primaryName || "Primary" : state.spouseName || "Spouse";
              return (
                <div key={who} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3 space-y-2">
                  <p className="text-slate-200 font-semibold text-sm">{title} Replacement</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={details.replacement.applies}
                      onChange={(e) => setDetails({ replacement: { ...details.replacement, applies: e.target.checked } })}
                      className="h-4 w-4 accent-cyan-500"
                    />
                    Replacement / Exchange applies
                  </label>
                  {details.replacement.applies && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <TextField value={details.replacement.amountOfInsurance} onChange={(v) => setDetails({ replacement: { ...details.replacement, amountOfInsurance: v } })} placeholder="Amount of insurance" />
                      <TextField value={details.replacement.insuredType} onChange={(v) => setDetails({ replacement: { ...details.replacement, insuredType: v } })} placeholder="Insured type" />
                      <TextField value={details.replacement.company} onChange={(v) => setDetails({ replacement: { ...details.replacement, company: v } })} placeholder="Company" />
                      <TextField value={details.replacement.benefit} onChange={(v) => setDetails({ replacement: { ...details.replacement, benefit: v } })} placeholder="Benefit / face amount" />
            </div>
          )}
                </div>
              );
            })}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-700 bg-slate-700/30 p-3 space-y-2">
                <p className="text-slate-200 font-semibold text-sm">{state.primaryName || "Primary"} Beneficiaries</p>
                <TextField value={state.primaryBene1.name} onChange={(v) => patch({ primaryBene1: { ...state.primaryBene1, name: v } })} placeholder="Primary beneficiary name" />
                <TextField value={state.primaryBene1.relationship} onChange={(v) => patch({ primaryBene1: { ...state.primaryBene1, relationship: v } })} placeholder="Primary beneficiary relationship" />
                <TextField value={state.primaryBene2.name} onChange={(v) => patch({ primaryBene2: { ...state.primaryBene2, name: v } })} placeholder="Contingent beneficiary name" />
                <TextField value={state.primaryBene2.relationship} onChange={(v) => patch({ primaryBene2: { ...state.primaryBene2, relationship: v } })} placeholder="Contingent beneficiary relationship" />
              </div>

              {showSpouseLifeSections && (
                <div className="rounded-lg border border-slate-700 bg-slate-700/30 p-3 space-y-2">
                  <p className="text-slate-200 font-semibold text-sm">{state.spouseName || "Spouse"} Beneficiaries</p>
                  <TextField value={state.spouseBene1.name} onChange={(v) => patch({ spouseBene1: { ...state.spouseBene1, name: v } })} placeholder="Primary beneficiary name" />
                  <TextField value={state.spouseBene1.relationship} onChange={(v) => patch({ spouseBene1: { ...state.spouseBene1, relationship: v } })} placeholder="Primary beneficiary relationship" />
                  <TextField value={state.spouseBene2.name} onChange={(v) => patch({ spouseBene2: { ...state.spouseBene2, name: v } })} placeholder="Contingent beneficiary name" />
                  <TextField value={state.spouseBene2.relationship} onChange={(v) => patch({ spouseBene2: { ...state.spouseBene2, relationship: v } })} placeholder="Contingent beneficiary relationship" />
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="6. Prescriptions">
          <div className="space-y-4">
            <RxEditor title={state.primaryName || "Primary"} entries={state.primaryRx} onChange={(v) => patch({ primaryRx: v })} />
            {state.hasSpouse && <RxEditor title={state.spouseName || "Spouse"} entries={state.spouseRx} onChange={(v) => patch({ spouseRx: v })} />}
          </div>
        </Section>

        <Section title="7. Banking and Finalize">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            <TextField value={state.banking.bankName} onChange={(v) => patch({ banking: { ...state.banking, bankName: v } })} placeholder="Bank name" />
            <TextField value={state.banking.holderName} onChange={(v) => patch({ banking: { ...state.banking, holderName: v } })} placeholder="Account holder" />
            <TextField value={state.banking.routing} onChange={(v) => patch({ banking: { ...state.banking, routing: v.replace(/\D/g, "").slice(0, 9) } })} placeholder="Routing (9 digits)" />
            <TextField value={state.banking.account} onChange={(v) => patch({ banking: { ...state.banking, account: v.replace(/\D/g, "") } })} placeholder="Account number" />
            <TextField value={state.banking.drawDay} onChange={(v) => patch({ banking: { ...state.banking, drawDay: Number(v) || 1 } })} placeholder="Draw day" type="number" />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.banking.accountType === "Checking"}
                  onChange={(e) => e.target.checked && patch({ banking: { ...state.banking, accountType: "Checking" } })}
                  className="h-4 w-4 accent-cyan-500"
                />
                Checking
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.banking.accountType === "Savings"}
                  onChange={(e) => e.target.checked && patch({ banking: { ...state.banking, accountType: "Savings" } })}
                  className="h-4 w-4 accent-cyan-500"
                />
                Savings
              </label>
              </div>
            </div>

          <div className="mb-4">
            <label className="block text-slate-300 text-xs mb-1">Mail Policy To</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.appMeta.mailTo === "Policyholder"}
                  onChange={(e) => e.target.checked && patch({ appMeta: { ...state.appMeta, mailTo: "Policyholder" } })}
                  className="h-4 w-4 accent-cyan-500"
                />
                Policyholder
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.appMeta.mailTo === "Agency"}
                  onChange={(e) => e.target.checked && patch({ appMeta: { ...state.appMeta, mailTo: "Agency" } })}
                  className="h-4 w-4 accent-cyan-500"
                />
                Agency
              </label>
            </div>
          </div>

          <label className="block text-slate-300 text-xs mb-1">Remarks</label>
          <textarea
              rows={3}
            value={state.appMeta.remarks}
            onChange={(e) => patch({ appMeta: { ...state.appMeta, remarks: e.target.value } })}
              className="w-full bg-slate-700 text-slate-100 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 resize-none"
          />

            {!canSync && (
            <div className="mt-4 bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                <p className="text-yellow-400 text-xs font-semibold mb-1">Required before sync:</p>
                <ul className="space-y-0.5">
                {syncIssues.map((issue) => (
                  <li key={issue} className="text-slate-300 text-xs">
                    - {issue}
                  </li>
                ))}
                </ul>
              </div>
            )}

            {syncResult && (
            <div className={`mt-4 rounded-lg p-3 border ${syncResult.ok ? "bg-green-900/40 border-green-600" : "bg-red-900/40 border-red-600"}`}>
              {syncResult.ok ? (
                <p className="text-green-300 text-sm font-bold">Saved{syncResult.injected ? " and injected into eApp" : " (eApp sync pending)"}</p>
              ) : (
                <p className="text-red-300 text-sm font-bold">Error: {syncResult.error}</p>
              )}
              </div>
            )}

          <button
            onClick={handleSync}
            disabled={!canSync || syncing}
            className="mt-4 w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-black text-lg rounded-xl transition-colors"
          >
            {syncing ? "Syncing..." : canSync ? "Sync to eApp" : "Complete required fields"}
            </button>
        </Section>
      </div>
    </div>
  );
}
