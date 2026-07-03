/**
 * Maps HPPRO SyncPresentation payload → flat string map for EappSync.exe POST /inject-next.
 * Keys match EappSync.cs UpdateUI / inject_escd_only.exe argv.
 */

import { pool } from './db.js';

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function safeObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Parse various DOB shapes → numeric month/day/year strings for inject_escd_only. */
export function parseDobParts(dob: unknown): { dobMonth: string; dobDay: string; dobYear: string } {
  const s = str(dob);
  if (!s) return { dobMonth: '', dobDay: '', dobYear: '' };
  // ISO YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    return {
      dobYear: iso[1],
      dobMonth: String(Number(iso[2])),
      dobDay: String(Number(iso[3])),
    };
  }
  // M/D/YYYY or MM/DD/YYYY
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) {
    return { dobMonth: String(Number(us[1])), dobDay: String(Number(us[2])), dobYear: us[3] };
  }
  return { dobMonth: '', dobDay: '', dobYear: '' };
}

function normalizeGender(g: unknown): string {
  const x = str(g).toLowerCase();
  if (x.startsWith('f')) return 'Female';
  return 'Male';
}

/**
 * Build inject-next body: all values must be strings (JavaScriptSerializer → Dictionary<string,string>).
 */
export function buildEappInjectPayloadFromSyncPresentation(payload: Record<string, unknown>): Record<string, string> {
  const bi = safeObj(payload.BasicInfo);
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = bi[k] ?? payload[k];
      const t = str(v);
      if (t) return t;
    }
    return '';
  };

  const firstName = pick('FirstName', 'firstName', 'InsuredFirstName', 'ClientFirstName');
  const lastName = pick('LastName', 'lastName', 'InsuredLastName', 'ClientLastName');
  const dobRaw = pick('DateOfBirth', 'DOB', 'BirthDate', 'Dob');
  let { dobMonth: dm, dobDay: dd, dobYear: dy } = parseDobParts(dobRaw);
  if (!dm) dm = str(bi.BirthMonth ?? bi.DOBMonth ?? payload.DOBMonth);
  if (!dd) dd = str(bi.BirthDay ?? bi.DOBDay ?? payload.DOBDay);
  if (!dy) dy = str(bi.BirthYear ?? bi.DOBYear ?? payload.DOBYear);

  const gender = normalizeGender(pick('Gender', 'Sex'));
  const phone = pick('PrimaryPhone', 'Phone', 'CellPhone', 'MobilePhone');
  const occupation = pick('Occupation', 'JobTitle');
  const city = pick('City');
  const zip = pick('Zip', 'ZipCode', 'PostalCode');
  const state = pick('StateCode', 'State');
  const groupName = pick('GroupName', 'txtGroupName', 'EmployerName');

  const spFirst = pick('SpouseFirstName', 'spouseFirstName');
  const spLast = pick('SpouseLastName', 'spouseLastName');
  const spDob = parseDobParts(pick('SpouseDateOfBirth', 'SpouseDOB'));
  let spM = spDob.dobMonth;
  let spD = spDob.dobDay;
  let spY = spDob.dobYear;
  if (!spM) spM = str(bi.SpouseBirthMonth);
  if (!spD) spD = str(bi.SpouseBirthDay);
  if (!spY) spY = str(bi.SpouseBirthYear);

  const email = pick('PrimaryEmail', 'Email', 'emailAddress');
  const address = pick('PrimaryAddress', 'Address1', 'Street');
  const spGender = normalizeGender(pick('SpouseGender', 'SpouseSex'));
  
  // Affiliation type: derive from group/union info
  const groupCode = str(bi.GroupCode ?? payload.GroupCode ?? '').toLowerCase();
  const groupNameLower = groupName.toLowerCase();
  let groupType = 'POS'; // default
  if (groupNameLower.includes('ufcw') || groupNameLower.includes('union') || groupCode.includes('union')) groupType = 'Union';
  else if (groupNameLower.includes('credit union')) groupType = 'CreditUnion';

  const out: Record<string, string> = {
    firstName,
    lastName,
    dobMonth: dm,
    dobDay: dd,
    dobYear: dy,
    gender,
    phone,
    email,
    occupation,
    spouseFirstName: spFirst,
    spouseLastName: spLast,
    spouseDobMonth: spM,
    spouseDobDay: spD,
    spouseDobYear: spY,
    spouseGender: spGender || (gender === 'Male' ? 'Female' : 'Male'),
    city,
    zip,
    state,
    groupName,
    address,
    groupType,
  };

  // ── Coverage / plan data from PlanOptions ──────────────────────────────────
  const planOptionsArr = Array.isArray(payload.PlanOptions) ? payload.PlanOptions : null;
  if (planOptionsArr && planOptionsArr.length > 0) {
    const coverage = extractCoverageFromPlanOptions(planOptionsArr);
    Object.assign(out, coverage);
  }

  // ── Extra FDS fields ──────────────────────────────────────────────────────
  // Application.State (2-letter)
  if (!out.state && bi.StateCode) out.state = str(bi.StateCode);

  // Monthly premium from PremiumPlan
  const pp = safeObj(payload.PremiumPlan);
  const monthlyPremium = pp.FinalMonthlyPremium ?? pp.finalMonthlyPremium;
  if (monthlyPremium != null) {
    const mpNum = parseFloat(String(monthlyPremium));
    if (!isNaN(mpNum) && mpNum > 0) out.totalPremium = mpNum.toFixed(2);
  }

  // IsSenior flag
  const isSenior = payload.IsSenior;
  if (isSenior != null) out.isSenior = isSenior ? 'True' : 'False';

  // Derive hasLife / hasAccident from coverage fields we just set
  out.hasLife = out.life1GroupId ? 'True' : 'False';
  out.hasAccident = out.accident1GroupId ? 'True' : 'False';
  out.hasSpouseLife = out.spouseLife1GroupId ? 'True' : 'False';
  // Spouse life coverage args for injector (after spouseLife1GroupId is populated)
  if (!out.spouseLife1GroupId) out.spouseLife1GroupId = '';
  if (!out.spouseLife1Face) out.spouseLife1Face = '0';
  if (!out.spouseLife1Units) out.spouseLife1Units = '0';

  return out;
}

// ── Coverage extraction from PlanOptions ──────────────────────────────────────

/** PlanOptions[].Products[].Plan shape (abbreviated to fields we need) */
interface HpproPlan {
  Coverage?: number | string;
  MDB?: string;
  CurrentProduct?: { Id?: number; Name?: string; PGName?: string };
  Option?: unknown;
  PlanOption?: string;
}

interface HpproProduct {
  Id?: number;
  Selected?: boolean;
  ProductId?: number;
  IsWHL?: boolean;
  Plan?: HpproPlan;
  WHLSelected?: boolean;
  Coverage?: number | string;
  MBD?: string;
  PlanOption?: string;
  CurrentProduct?: { Id?: number; Name?: string; PGName?: string };
}

interface HpproPlanOption {
  Id?: number;
  Name?: string;
  isSelected?: boolean;
  IsChecked?: boolean;
  Products?: HpproProduct[];
  PrimaryProducts?: HpproProduct[] | Record<string, unknown>;
  SpouseProducts?: HpproProduct[] | Record<string, unknown>;
  TotalAHP?: string;
  TotalALP?: string;
}

/** HPPRO productId → eApp GroupId mapping for coverage injection */
const PRODUCT_ID_TO_GROUP: Record<number, { groupId: string; vpu: number; eappKey: string }> = {
  1:  { groupId: 'R',     vpu: 1000, eappKey: 'Life1Coverage' },   // WL Regular placeholder; actual subplan from CurrentProduct.Id
  2:  { groupId: 'LPU65', vpu: 1000, eappKey: 'Life1Coverage' },
  3:  { groupId: 'SR10',  vpu: 1000, eappKey: 'Life1Coverage' },   // Senior Graded WL
  4:  { groupId: 'LESWL', vpu: 1000, eappKey: 'Life1Coverage' },   // Level Senior WL
  5:  { groupId: 'RC4Y',  vpu: 1000, eappKey: 'Life1Coverage' },
  6:  { groupId: 'RC10Y', vpu: 1000, eappKey: 'Life1Coverage' },
  7:  { groupId: 'T20',   vpu: 1000, eappKey: 'Life1Coverage' },
  8:  { groupId: 'DT15',  vpu: 1000, eappKey: 'Life1Coverage' },
  9:  { groupId: 'DT30',  vpu: 1000, eappKey: 'Life1Coverage' },
  10: { groupId: 'T65',   vpu: 1000, eappKey: 'Life1Coverage' },
  12: { groupId: 'SPR',   vpu: 1000, eappKey: 'LifeSpouseCoverage' },
  14: { groupId: 'ADB',   vpu: 1000, eappKey: 'Accident1Coverage' },
  15: { groupId: 'B2000', vpu: 1000, eappKey: 'Accident1Coverage' },
  17: { groupId: 'A71',   vpu: 100,  eappKey: 'Accident1Coverage' }, // A71000 – $100/unit
  18: { groupId: 'C20',   vpu: 1000, eappKey: 'Accident1Coverage' },
  19: { groupId: 'CNM',   vpu: 1000, eappKey: 'Accident1Coverage' },
};

// For ProductId=1 (Whole Life), the CurrentProduct.Id picks the actual sub-plan
const WHL_SUBPRODUCT_TO_GROUP: Record<number, { groupId: string; vpu: number }> = {
  1:  { groupId: 'R',     vpu: 1000 }, // WL Regular (MinCoverage 1–34,999)
  2:  { groupId: 'LPU65', vpu: 1000 }, // LPU65
  3:  { groupId: 'SR10',  vpu: 1000 }, // Senior Graded WL
  4:  { groupId: 'LESWL', vpu: 1000 }, // Level Senior WL
  // CoverageTypeId-based sub-plans
  // Some HPPRO versions use CoverageTypeId in the coverage config
};

// CoverageTypeId → groupId for WHL adult plans
const WHL_COVERAGE_TYPE_TO_GROUP: Record<number, string> = {
  1: 'R',    // WHL(R) – Regular
  2: 'PR',   // WHL(P) – Preferred
  3: 'EX',   // WHL(EX) – Executive
  4: 'SL',   // WHL(SL) – Select
};

function parseCoverage(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') return Math.round(parseFloat(v.replace(/,/g, '')) || 0);
  return 0;
}

/**
 * Extract coverage details from PlanOptions.
 * Returns flat string fields to merge into inject payload.
 */
export function extractCoverageFromPlanOptions(planOptions: unknown): Record<string, string> {
  if (!Array.isArray(planOptions) || planOptions.length === 0) return {};

  // Find the selected plan (isSelected: true), fall back to first IsChecked
  const plans = planOptions as HpproPlanOption[];
  const selected = plans.find(p => p.isSelected === true)
    ?? plans.find(p => p.IsChecked === true)
    ?? plans[0];

  if (!selected) return {};

  const out: Record<string, string> = {
    selectedPlanName: str(selected.Name),
  };

  // ── Primary products (WL-family) ──────────────────────────────────────────
  const primaryProds: HpproProduct[] = Array.isArray(selected.PrimaryProducts)
    ? (selected.PrimaryProducts as HpproProduct[])
    : [];

  for (const prod of primaryProds) {
    if (!prod.Selected) continue;
    const productId = prod.ProductId ?? prod.Plan?.CurrentProduct?.Id ?? 0;
    const currentProductId = prod.Plan?.CurrentProduct?.Id ?? prod.CurrentProduct?.Id ?? productId;
    const faceRaw = parseCoverage(prod.Plan?.Coverage ?? prod.Coverage);

    // Determine groupId: use currentProductId (sub-plan) first, fallback to productId
    let groupId = '';
    let vpu = 1000;

    if (currentProductId && WHL_SUBPRODUCT_TO_GROUP[currentProductId]) {
      groupId = WHL_SUBPRODUCT_TO_GROUP[currentProductId].groupId;
      vpu = WHL_SUBPRODUCT_TO_GROUP[currentProductId].vpu;
    } else if (productId && PRODUCT_ID_TO_GROUP[productId]) {
      groupId = PRODUCT_ID_TO_GROUP[productId].groupId;
      vpu = PRODUCT_ID_TO_GROUP[productId].vpu;
    }

    if (!groupId || faceRaw <= 0) continue;

    const units = Math.round(faceRaw / vpu);
    const face = units * vpu;

    const eappKey = (PRODUCT_ID_TO_GROUP[productId] ?? PRODUCT_ID_TO_GROUP[currentProductId])?.eappKey ?? 'Life1Coverage';

    if (eappKey === 'LifeSpouseCoverage') {
      out.spouseLife1GroupId = groupId;
      out.spouseLife1Face = String(face);
      out.spouseLife1Units = String(units);
    } else {
      out.life1GroupId = groupId;
      out.life1Face = String(face);
      out.life1Units = String(units);
    }
  }

  // ── Spouse products (spouse WL/SRGWL via SpouseProducts) ─────────────────
  const spouseProds: HpproProduct[] = Array.isArray(selected.SpouseProducts)
    ? (selected.SpouseProducts as HpproProduct[])
    : [];

  for (const prod of spouseProds) {
    if (!prod.Selected) continue;
    const productId = prod.ProductId ?? prod.Plan?.CurrentProduct?.Id ?? 0;
    const currentProductId = prod.Plan?.CurrentProduct?.Id ?? prod.CurrentProduct?.Id ?? productId;
    const faceRaw = parseCoverage(prod.Plan?.Coverage ?? prod.Coverage);

    let groupId = '';
    let vpu = 1000;

    if (currentProductId && WHL_SUBPRODUCT_TO_GROUP[currentProductId]) {
      groupId = WHL_SUBPRODUCT_TO_GROUP[currentProductId].groupId;
      vpu = WHL_SUBPRODUCT_TO_GROUP[currentProductId].vpu;
    } else if (productId && PRODUCT_ID_TO_GROUP[productId]) {
      groupId = PRODUCT_ID_TO_GROUP[productId].groupId;
      vpu = PRODUCT_ID_TO_GROUP[productId].vpu;
    }

    if (!groupId || faceRaw <= 0) continue;
    const units = Math.round(faceRaw / vpu);
    const face = units * vpu;

    out.spouseLife1GroupId = groupId;
    out.spouseLife1Face = String(face);
    out.spouseLife1Units = String(units);
  }

  // ── Additional products (A71, ADB, riders etc.) ───────────────────────────
  const addlProds: HpproProduct[] = Array.isArray(selected.Products)
    ? (selected.Products as HpproProduct[])
    : [];

  for (const prod of addlProds) {
    if (!prod.Selected) continue;
    const productId = prod.ProductId ?? prod.Plan?.CurrentProduct?.Id ?? 0;
    if (!productId || !PRODUCT_ID_TO_GROUP[productId]) continue;

    const { groupId, vpu, eappKey } = PRODUCT_ID_TO_GROUP[productId];
    const faceRaw = parseCoverage(prod.Plan?.Coverage ?? prod.Coverage);
    if (faceRaw <= 0) continue;

    const units = Math.round(faceRaw / vpu);
    const face = units * vpu;

    if (eappKey === 'Accident1Coverage') {
      out.accident1GroupId = groupId;
      out.accident1Face = String(face);
      out.accident1Units = String(units);
    } else if (eappKey === 'LifeSpouseCoverage') {
      out.spouseLife1GroupId = groupId;
      out.spouseLife1Face = String(face);
      out.spouseLife1Units = String(units);
    } else if (!out.life1GroupId) {
      out.life1GroupId = groupId;
      out.life1Face = String(face);
      out.life1Units = String(units);
    }
  }

  return out;
}

/** True when presentation has a terminal outcome string from HPPRO (adjust list as needed). */
export function shouldQueueEappInject(payload: Record<string, unknown>): boolean {
  const w = str(payload.WhatHappenedString);
  if (!w) return false;
  return true;
}

export async function upsertHpproEappPending(opts: {
  agentEmail: string;
  presentationGuid: string;
  injectPayload: Record<string, string>;
  whatHappened: string;
}): Promise<{ ok: boolean; error?: string }> {
  const email = opts.agentEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'invalid agent email' };

  try {
    await pool.query(
      `INSERT INTO hppro_eapp_pending (agent_email, presentation_guid, inject_payload, what_happened, consumed_at, created_at)
       VALUES ($1, $2, $3, $4, NULL, NOW())
       ON CONFLICT (agent_email, presentation_guid)
       DO UPDATE SET inject_payload = $3, what_happened = $4, consumed_at = NULL`,
      [email, opts.presentationGuid, JSON.stringify(opts.injectPayload), opts.whatHappened || null]
    );
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
