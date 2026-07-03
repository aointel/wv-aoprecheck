/**
 * Eapp dropdown screenshot analysis.
 * Vision extracts agent number + state abbreviations using an example image; we merge states into customer.states.
 */

import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { OPENAI_API_KEY } from './hardcoded-config';
import { supabaseAdmin } from './supabase';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const EXAMPLE_IMAGE_PATH = path.join(process.cwd(), 'server', 'assets', 'eapp-screenshot-example.png');

function loadExampleImageBase64(): string {
  if (!fs.existsSync(EXAMPLE_IMAGE_PATH)) {
    throw new Error(`Eapp example image missing at ${EXAMPLE_IMAGE_PATH}`);
  }
  const buf = fs.readFileSync(EXAMPLE_IMAGE_PATH);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY'
};

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean);
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const p = JSON.parse(t);
        return Array.isArray(p) ? p.filter((x: unknown) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean) : [];
      } catch { return t.split(',').map(s => s.trim()).filter(Boolean); }
    }
    return t.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeToStateCodes(raw: string[]): string[] {
  const out: string[] = [];
  for (const s of raw) {
    const u = s.toUpperCase().trim();
    if (u.length === 2 && US_STATE_CODES.has(u)) {
      out.push(u);
      continue;
    }
    const byName = STATE_NAME_TO_CODE[s.toLowerCase().trim()];
    if (byName) out.push(byName);
  }
  return [...new Set(out)];
}

export interface EappAnalyzeResult {
  accepted: boolean;
  error?: string;
  agentNumber?: string;
  states?: string[];
  /** States we read from the image (before merge). Use for UI: only these are shown; grey = previous, clickable = added. */
  detectedStates?: string[];
  added?: string[];
  previous?: string[];
}

export async function analyzeEappScreenshot(
  imageBase64: string,
  userEmail: string
): Promise<EappAnalyzeResult> {
  const prompt = `Image 1 is an EXAMPLE of what we need. It shows an Eapp form with:
- An "Agent" field visible containing the agent number (e.g. ANF85-00).
- A "State" dropdown open showing two-letter US state abbreviations (e.g. AK, CA, FL, MI, NC, OH, OR, SC, TX, VA, and more in the list).

Image 2 is the user's screenshot. Extract:
1) The agent number from the Agent field (exactly as shown).
2) ALL state abbreviations visible in the State dropdown (2-letter codes only).

Both the agent number and the state list must be clearly readable. If either is missing, blurry, or the layout doesn't match the example, treat it as unreadable.

Reply with JSON only. No other text.
- If you can read both agent number and at least one state: {"readable": true, "agentNumber": "ANF85-00", "states": ["AK", "CA", "FL", ...]}
- Otherwise: {"readable": false, "reason": "brief explanation"}`;

  const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1]!.trim() : imageBase64;
  const mime = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/png';
  const userImageUrl = `data:${mime};base64,${base64Data}`;
  const exampleImageUrl = loadExampleImageBase64();

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: exampleImageUrl, detail: 'high' } },
          { type: 'image_url', image_url: { url: userImageUrl, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.1
  });

  const raw = res.choices[0]?.message?.content || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? (() => { try { return JSON.parse(jsonMatch[0]); } catch { return {}; } })() : {};

  if (parsed.readable === false) {
    return {
      accepted: false,
      error: "We couldn't read the agent number or state list. Please submit a clearer screenshot showing both the Agent field and the State dropdown open (like the example)."
    };
  }

  const agentNumber = typeof parsed.agentNumber === 'string' ? parsed.agentNumber.trim() : '';
  const rawStates = Array.isArray(parsed.states) ? parsed.states : [];
  const states = normalizeToStateCodes(rawStates);

  if (!agentNumber) {
    return {
      accepted: false,
      error: "We couldn't find the agent number in the image. Please ensure the Agent field (e.g. ANF85-00) is visible and submit again."
    };
  }
  if (states.length === 0) {
    return {
      accepted: false,
      error: "We couldn't find any valid state abbreviations in the State dropdown. Please ensure the dropdown is open and states are visible, then submit again."
    };
  }

  const email = userEmail.toLowerCase().trim();
  const { data: customer, error: custErr } = await supabaseAdmin!
    .from('customers')
    .select('states, company_email')
    .eq('company_email', email)
    .maybeSingle();

  if (custErr || !customer) {
    return {
      accepted: false,
      error: "We couldn't find your account. Please use the same email you're logged in with."
    };
  }

  const previous = parseArrayField(customer.states).map(s => s.toUpperCase());
  const existingSet = new Set(previous);
  const added = states.filter(s => !existingSet.has(s));
  // REPLACE states with the ones from the screenshot (don't merge with previous)
  const newStates = [...new Set(states)];

  const { error: updateErr } = await supabaseAdmin!
    .from('customers')
    .update({ states: newStates })
    .eq('company_email', email);

  if (updateErr) {
    return {
      accepted: false,
      error: "We read the states but couldn't update your profile. Please try again or contact support."
    };
  }

  return {
    accepted: true,
    agentNumber,
    states: newStates,
    detectedStates: states,
    added,
    previous
  };
}
