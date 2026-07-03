/**
 * cs-bot.ts — AI Customer Service Bot for the 914 inbound number (+19142289324)
 *
 * Flow:
 *   1. Twilio calls POST /cs-bot/voice when someone dials the 914 number
 *   2. We look up the caller in masterlead by phone, pass their name + context as stream params
 *   3. We return TwiML <Connect><Stream> pointing at wss://host/cs-bot/stream
 *   4. Twilio opens a WebSocket and streams raw mulaw audio both directions
 *   5. We bridge that stream to OpenAI Realtime API (g711_ulaw format = no resampling needed)
 *   6. OpenAI responds with AI speech; we forward it back to Twilio which plays it to the caller
 *
 * To activate: point the 914 Twilio number's Voice URL to
 *   https://aoirail-production.up.railway.app/cs-bot/voice
 */

import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import type { Express } from 'express';
import express from 'express';

function buildSystemPrompt(callerName: string | null, callerContext: string | null): string {
  const nameIntro = callerName
    ? `The caller's name is ${callerName}. Use their name naturally 1-2 times in the conversation.`
    : 'You do not know the caller\'s name yet — ask for it once naturally if needed.';

  return `You are Alex, a friendly and knowledgeable customer service representative for AO Globe Life, a leading life insurance and benefits company. You answer inbound calls from customers, prospects, and agents.

${nameIntro}
${callerContext ? `Caller context from our records: ${callerContext}` : ''}

━━━ YOUR CORE JOB ━━━
Your job is to SOLVE the caller's problem on this call, not hand them off. You have full knowledge of our products and policies. Transfer to a live specialist ONLY as a true last resort — when the caller explicitly and repeatedly demands it, or when a legally sensitive action (like processing a payment or changing a beneficiary) requires a human.

━━━ PRODUCT KNOWLEDGE ━━━

Globe Life / AO Globe Life Products:
• Term Life Insurance: Simple, affordable coverage. No medical exam required. Face amounts from $5,000 to $100,000. Premiums start as low as $1/month for children, $3.49/month for adults. Rates lock in at enrollment age.
• Whole Life Insurance: Permanent coverage that builds cash value. Available for ages 0-85. No medical exam. Premiums never increase. Coverage never decreases as long as premiums are paid.
• Accident Insurance: Covers accidental injuries, hospitalization, dismemberment. Pays cash benefits directly to you — not to the hospital. Available for individuals and families.
• Supplemental Health Insurance: Cancer, Critical Illness, Hospital Confinement plans. Pays cash on top of existing health insurance.
• AO Globe Life Veteran products: Specialized life and accident coverage for veterans and active military. Benefits tied to VA eligibility.

How we work:
• No medical exam required for most products — just answer a few health questions
• Coverage begins the next business day after application approval
• 30-day free look period — full refund if not satisfied
• Bills can be paid monthly, quarterly, semi-annually, or annually
• To check on a policy: agents need the policy number and policyholder's name/DOB
• Claims: submit online at globelife.com/claims or call 1-800-811-2400

━━━ HANDLING COMMON CALL TYPES ━━━

"Someone called me from this number":
→ Explain: "Yes, one of our licensed agents reached out because you or someone in your household may have requested information about life insurance or benefits coverage. Can I ask — do you recall requesting information recently, or would you like me to find out what they were reaching out about?"
→ Try to understand their interest level and provide info. Do NOT just brush them off.

"I got a call about a Veteran Will Kit / benefits":
→ "Yes, we reach out to veterans to make sure you're aware of insurance benefits available to you. The Will Kit is a complimentary resource. Our agent wanted to discuss life insurance options specifically designed for veterans. Can I tell you a little about what's available?"
→ Actually explain the veteran products. Answer their questions fully.

"I want to remove my number / stop calling me":
→ "Absolutely, I completely understand. I'm noting your request right now and your number will be removed from our contact list within 24-48 business hours. I'm sorry for any inconvenience. Is there anything else I can help you with today?"
→ Do NOT just say you'll note it and hang up. Confirm it warmly, apologize, and close the call properly.

"What does Globe Life do?" / "What do you sell?":
→ Give a genuine, clear explanation of the company and product lines. Offer to explain any product in detail.

"I already have a policy — I have a question about it":
→ Ask for their policy number and name. For general questions (when does it renew, what's covered, how do I add a beneficiary), answer from your knowledge above.
→ For account-specific details (exact premium amount, balance, claim status): "I want to make sure I give you the exact right information — let me have a specialist pull that up for you. What's the best number to reach you at?" Then offer callback or warm transfer.

"I want to cancel my policy":
→ Do NOT immediately offer to transfer. Instead: "I'm sorry to hear that — can I ask what's prompting the cancellation? Sometimes there are options like a premium reduction, a payment pause, or adjusting the coverage amount that might work better. I want to make sure you have all the options before making a final decision."
→ Try to save the policy. Only offer transfer if they insist.

"I want to make a payment":
→ "Payments can be made online at globelife.com, by calling our billing line at 1-800-811-2400, or by mailing a check to Globe Life, PO Box 8080, McKinney, TX 75070. Which works best for you?"

"I want to file a claim":
→ "You can file a claim online at globelife.com/claims or call our claims department directly at 1-800-811-2400. They're available Monday–Friday 8am–6pm Central. Do you want me to walk you through the online process?"

"I want to speak to my agent" / "Is [agent name] available?":
→ "I don't have direct transfer to individual agents, but I can take your name and number and have your agent call you back. What's the best number and time to reach you?"

"Is this a real person?" / "Are you a bot?" / "Am I talking to AI?":
→ "I'm an AI assistant for AO Globe Life. I'm here to help answer your questions and solve problems — most things I can handle right now. What can I help you with?"

━━━ TONE & STYLE ━━━
- Warm, calm, and genuinely helpful — never robotic
- Keep responses concise: 2-4 sentences. One point at a time.
- Never say "I'm unable to" or "I don't have access to" — find a way to help
- Never end a call abruptly. Always close warmly: "Is there anything else I can help you with today? Thank you for calling AO Globe Life."
- If the caller is upset or frustrated: acknowledge first. "I completely understand your frustration — let me help fix this right now."
- Moderate pace, clear pronunciation

━━━ TRANSFER RULE ━━━
Only say "let me connect you with a specialist" if:
1. The caller has explicitly asked for a live person at least twice, OR
2. The action literally requires a human (processing payment, legal beneficiary change, complex claim dispute)
In all other cases — TRY TO HELP FIRST.

Greeting: "Thank you for calling AO Globe Life customer service. This is Alex — how can I help you today?"`;
}

async function lookupCaller(phone: string): Promise<{ name: string | null; context: string | null }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      'https://ycztjetxwpfgtrzeyytt.supabase.co',
      'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
    );

    const last10 = phone.replace(/\D/g, '').slice(-10);
    if (last10.length < 7) return { name: null, context: null };

    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`phone.ilike.%${last10}%,personal_phone.ilike.%${last10}%,cell_phone.ilike.%${last10}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { name: null, context: null };

    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
    const parts: string[] = [];
    if (data.state) parts.push(`state: ${data.state}`);
    if (data.market) parts.push(`market: ${data.market}`);
    if (data.mga_name) parts.push(`MGA: ${data.mga_name}`);
    const context = parts.length ? parts.join(', ') : null;

    return { name, context };
  } catch (e) {
    console.warn('[CsBot] Lead lookup failed:', (e as Error).message);
    return { name: null, context: null };
  }
}

export function setupCsBot(app: Express, server: Server): void {
  // ── 1. TwiML webhook — Twilio calls this when 914 receives an inbound call ──
  app.post('/cs-bot/voice', express.urlencoded({ extended: false }), async (req, res) => {
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
    const streamUrl = `wss://${host}/cs-bot/stream`;

    const callSid = req.body?.CallSid || 'unknown';
    const from = req.body?.From || '';
    console.log(`[CsBot] Inbound call CallSid=${callSid} From=${from} → streaming to ${streamUrl}`);

    // Look up caller before connecting so we can personalize greeting
    const { name, context } = await lookupCaller(from).catch(() => ({ name: null, context: null }));
    if (name) console.log(`[CsBot] Caller identified: ${name}`);

    const nameParam = encodeURIComponent(name || '');
    const ctxParam  = encodeURIComponent(context || '');

    res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${callSid}"/>
      <Parameter name="callerName" value="${nameParam}"/>
      <Parameter name="callerContext" value="${ctxParam}"/>
    </Stream>
  </Connect>
</Response>`);
  });

  // ── 2. WebSocket handler — bridges Twilio Media Streams ↔ OpenAI Realtime ──
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url || '').pathname;
    if (pathname === '/cs-bot/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (twilioWs) => {
    console.log('[CsBot] Twilio Media Stream connected');

    const { OPENAI_API_KEY } = await import('./hardcoded-config.js');
    if (!OPENAI_API_KEY) {
      console.error('[CsBot] No OpenAI key — closing');
      twilioWs.close();
      return;
    }

    let streamSid: string | null = null;
    let openaiWs: WebSocket | null = null;
    let openaiReady = false;
    let callerName: string | null = null;
    let callerContext: string | null = null;
    const audioBuffer: string[] = [];

    // ── Open OpenAI Realtime connection ──
    openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    openaiWs.on('open', () => {
      console.log('[CsBot] Connected to OpenAI Realtime');

      const systemPrompt = buildSystemPrompt(callerName, callerContext);

      openaiWs!.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: systemPrompt,
          voice: 'alloy',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.4,        // slightly more sensitive — catch quieter speech
            prefix_padding_ms: 400, // more padding before speech detected
            silence_duration_ms: 900, // wait longer before assuming caller is done (less cutting off)
          },
          temperature: 0.7,
          max_response_output_tokens: 600,
        },
      }));

      // Trigger greeting
      openaiWs!.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: callerName
            ? `Greet the caller by name (${callerName}) warmly. Use the greeting from your system prompt but personalize it with their name.`
            : 'Greet the caller now using the greeting in your system prompt.',
        },
      }));

      openaiReady = true;

      // Flush buffered audio
      for (const payload of audioBuffer) {
        openaiWs!.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: payload }));
      }
      audioBuffer.length = 0;
    });

    // Forward OpenAI audio output → Twilio
    openaiWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'response.audio.delta' && msg.delta && streamSid) {
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid,
            media: { payload: msg.delta },
          }));
        }

        if (msg.type === 'response.audio_transcript.delta') {
          process.stdout.write(`[CsBot AI] ${msg.delta}`);
        }

        if (msg.type === 'response.audio_transcript.done') {
          process.stdout.write('\n');
        }

        // Caller spoke — stop current AI response to avoid talking over them
        if (msg.type === 'input_audio_buffer.speech_started') {
          if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
          }
          // Also cancel the in-progress AI response
          if (openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: 'response.cancel' }));
          }
        }
      } catch (_) {}
    });

    openaiWs.on('error', (err) => {
      console.error('[CsBot] OpenAI WS error:', err.message);
    });

    openaiWs.on('close', () => {
      console.log('[CsBot] OpenAI WS closed');
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
    });

    // ── Receive Twilio Media Stream events ──
    twilioWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.event === 'start') {
          streamSid = msg.start?.streamSid ?? null;
          // Extract caller name + context passed from the voice webhook
          const params = msg.start?.customParameters ?? {};
          callerName = params.callerName ? decodeURIComponent(params.callerName) || null : null;
          callerContext = params.callerContext ? decodeURIComponent(params.callerContext) || null : null;
          console.log(`[CsBot] Stream started streamSid=${streamSid} caller=${callerName || 'unknown'}`);
        }

        if (msg.event === 'media' && msg.media?.track === 'inbound') {
          const payload = msg.media.payload as string;
          if (openaiReady && openaiWs?.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: payload }));
          } else {
            audioBuffer.push(payload);
          }
        }

        if (msg.event === 'stop') {
          console.log('[CsBot] Stream stopped');
          if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
        }
      } catch (_) {}
    });

    twilioWs.on('close', () => {
      console.log('[CsBot] Twilio WS disconnected');
      if (openaiWs?.readyState === WebSocket.OPEN) openaiWs.close();
    });

    twilioWs.on('error', (err) => {
      console.error('[CsBot] Twilio WS error:', err.message);
    });
  });

  console.log('✅ CsBot registered: POST /cs-bot/voice, WS /cs-bot/stream');
}
