/**
 * Call Analytics Disposition Model
 * Parameters and rules per disposition (outcome). Loaded from Supabase (call_analytics_disposition_rules)
 * when available; falls back to built-in DISPOSITION_MODEL. Editable via Call Analytics Admin UI.
 */

import { supabaseAdmin } from './supabase';

export type CallOutcomeAI = 'SOLD' | 'BOOKED' | 'CALLBACK' | 'THINK' | 'NO_SHOW' | 'OBJECTION' | 'OTHER';

export interface DispositionRule {
  /** Min call duration (seconds) for this disposition to be valid. e.g. instant_presentation requires 8+ min. */
  minDurationSec?: number;
  /** Max duration (seconds) - e.g. spanish often < 2 min. */
  maxDurationSec?: number;
  /** If true, set scorecard to 0 when this disposition is used (e.g. no_answer_vm). */
  scorecardZero?: boolean;
  /** Transcript clues that support this disposition (for prompt / validation). */
  transcriptIndicators?: string[];
  /** Transcript clues that DISQUALIFY this disposition. */
  mustNotContain?: string[];
}

export interface DispositionDefinition {
  /** CCPRO disposition value (stored in DB, matches Call Connector Pro). */
  id: string;
  /** Human label. */
  label: string;
  /** When to use this disposition; what we're looking for. */
  description: string;
  /** AI callOutcome(s) that map to this disposition. */
  callOutcomeMapping: CallOutcomeAI[];
  rules?: DispositionRule;
}

/** All dispositions with parameters and rules. Order matters for prompt (primary outcomes first). */
export const DISPOSITION_MODEL: DispositionDefinition[] = [
  {
    id: 'no_answer_vm',
    label: 'No Answer / Voicemail',
    description: 'Prospect did NOT speak. Voicemail (beep, leave a message), disconnected, or ring-out. One-sided: only agent talking, no prospect replies. Use when you hear: "leave a message", "after the beep", automated greeting, no human on line.',
    callOutcomeMapping: ['NO_SHOW'],
    rules: {
      scorecardZero: true,
      transcriptIndicators: ['leave a message', 'after the beep', 'not available', 'voicemail', 'message machine', 'one-sided', 'only agent speaking'],
      mustNotContain: ['prospect said', 'client said', 'they said', 'customer replied'],
    },
  },
  {
    id: 'spanish',
    label: 'Spanish',
    description: 'Prospect or context indicates need for Spanish speaker (we don\'t have one). Transcript mentions: spanish, español, speak spanish, habla español. Usually short (< 2 min). Do NOT use CALLBACK for these.',
    callOutcomeMapping: ['OTHER'],
    rules: {
      maxDurationSec: 150, // often under 2.5 min
      transcriptIndicators: ['spanish', 'español', 'espanol', 'speak spanish', 'habla español'],
    },
  },
  {
    id: 'sale',
    label: 'Sale',
    description: 'Prospect purchased / closed the sale. Money committed, policy sold.',
    callOutcomeMapping: ['SOLD'],
    rules: {
      transcriptIndicators: ['sold', 'purchased', 'signed', 'enrolled', 'payment', 'policy', 'closed the sale'],
    },
  },
  {
    id: 'booked',
    label: 'Booked',
    description: 'Agent scheduled a SPECIFIC appointment (date and/or time set). Use only when an appointment was actually set—not just "call back later".',
    callOutcomeMapping: ['BOOKED'],
    rules: {
      minDurationSec: 30, // real booking usually has some dialogue
      transcriptIndicators: ['appointment', 'scheduled', 'set for', 'date', 'time', 'calendar', 'tomorrow at', 'next week'],
      mustNotContain: ['just call back', 'call me later', 'no specific time'],
    },
  },
  {
    id: 'call_back',
    label: 'Call Back',
    description: 'Prospect wants to be called back later but NO specific appointment was set. "Call me later", "try again tomorrow", interest but no date/time set.',
    callOutcomeMapping: ['CALLBACK'],
    rules: {
      transcriptIndicators: ['call back', 'call me later', 'try again', 'reach out later', 'not a good time', 'busy right now'],
    },
  },
  {
    id: 'instant_presentation',
    label: 'Instant Presentation',
    description: 'Full presentation was given but no sale, no appointment, no callback set. Prospect heard the full pitch. ONLY valid when call is at least 8 minutes (480 seconds). Shorter calls cannot be "full presentation"—use call_back or not_interested instead.',
    callOutcomeMapping: ['OTHER'],
    rules: {
      minDurationSec: 8 * 60, // 8 minutes
      transcriptIndicators: ['full presentation', 'went through the pitch', 'explained the product', 'heard everything'],
      mustNotContain: ['voicemail', 'leave a message', 'no answer'],
    },
  },
  {
    id: 'not_interested',
    label: 'Not Interested',
    description: 'Prospect said no, needs to think, raised objections and is not moving forward. Not interested, objection, think about it.',
    callOutcomeMapping: ['THINK', 'OBJECTION'],
    rules: {
      transcriptIndicators: ['not interested', 'no thanks', 'think about it', 'objection', 'not right now', 'maybe later', 'don\'t need'],
    },
  },
];

/** In-memory cache from Supabase; null = use DISPOSITION_MODEL. */
let cachedDefinitions: DispositionDefinition[] | null = null;

/** Load disposition rules from Supabase into cache. Call after server start and after UI updates. */
export async function loadDispositionModelFromDb(): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin
      .from('call_analytics_disposition_rules')
      .select('id, label, description, prompt_instructions, min_duration_sec, max_duration_sec, scorecard_zero, transcript_indicators, must_not_contain, call_outcome_mapping, sort_order, active')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error || !data?.length) {
      cachedDefinitions = null;
      return;
    }
    cachedDefinitions = data.map((row: any) => ({
      id: row.id,
      label: row.label ?? row.id,
      description: row.description ?? '',
      callOutcomeMapping: Array.isArray(row.call_outcome_mapping) ? row.call_outcome_mapping : (row.call_outcome_mapping ? [row.call_outcome_mapping] : []),
      rules: {
        minDurationSec: row.min_duration_sec ?? undefined,
        maxDurationSec: row.max_duration_sec ?? undefined,
        scorecardZero: row.scorecard_zero ?? false,
        transcriptIndicators: Array.isArray(row.transcript_indicators) ? row.transcript_indicators : [],
        mustNotContain: Array.isArray(row.must_not_contain) ? row.must_not_contain : [],
      },
    }));
  } catch {
    cachedDefinitions = null;
  }
}

/** Current definitions (DB cache or static). */
function getDefinitions(): DispositionDefinition[] {
  return cachedDefinitions ?? DISPOSITION_MODEL;
}

/** Map AI callOutcome to CCPRO disposition using the model. */
export function getDispositionFromCallOutcome(callOutcome: CallOutcomeAI | string): string {
  const upper = (callOutcome || '').toUpperCase() as CallOutcomeAI;
  const def = getDefinitions().find((d) => d.callOutcomeMapping.includes(upper));
  return def?.id ?? 'instant_presentation';
}

/** Get disposition definition by id. */
export function getDispositionDefinition(id: string): DispositionDefinition | undefined {
  return getDefinitions().find((d) => d.id === id);
}

/** Build the disposition rules section for the analyzer prompt (what the AI must follow). */
export function buildDispositionPromptSection(): string {
  const defs = getDefinitions();
  const lines: string[] = [
    '**DISPOSITION RULES (follow strictly):**',
    '',
  ];
  for (const d of defs) {
    lines.push(`- **${d.id}** (from AI outcome ${d.callOutcomeMapping.join(' or ')}): ${d.description}`);
    if (d.rules?.minDurationSec) {
      const minMin = Math.round(d.rules.minDurationSec / 60);
      lines.push(`  - REQUIRED: Call duration must be at least ${minMin} minutes (${d.rules.minDurationSec} seconds). Shorter calls must NOT use this disposition.`);
    }
    if (d.rules?.maxDurationSec) {
      lines.push(`  - Typically call is under ${Math.round(d.rules.maxDurationSec / 60)} minutes.`);
    }
    if (d.rules?.scorecardZero) {
      lines.push(`  - When using this disposition, set all scorecard scores to 0 (overallScore 0).`);
    }
    if (d.rules?.transcriptIndicators?.length) {
      lines.push(`  - Look for: ${d.rules.transcriptIndicators.slice(0, 5).join('; ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Apply duration and other rules post-analysis. Returns the final disposition to store. */
export function applyDispositionRules(
  disposition: string,
  callDurationSec: number | null | undefined
): string {
  const def = getDispositionDefinition(disposition);
  if (!def?.rules) return disposition;

  const sec = normalizeDurationToSeconds(callDurationSec);

  // Min duration: if call is shorter than required, override to call_back
  if (def.rules.minDurationSec != null && sec > 0 && sec < def.rules.minDurationSec) {
    if (disposition === 'instant_presentation') return 'call_back';
    if (disposition === 'booked' && sec < 30) return 'call_back';
  }
  // Under 1 min = never instant_presentation (full presentation impossible)
  if (disposition === 'instant_presentation' && sec > 0 && sec < 60) return 'call_back';

  // Max duration hint: we don't override, but could log or nudge in prompt only
  return disposition;
}

function normalizeDurationToSeconds(value: number | null | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const n = Number(value);
  if (n > 7200) return Math.round(n / 1000);
  return n;
}

/** For backward compatibility: min seconds for instant_presentation (8 min). */
export const INSTANT_PRESENTATION_MIN_DURATION_SEC = 8 * 60;
