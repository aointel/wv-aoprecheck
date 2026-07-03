import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Globe,
  HelpCircle,
  Key,
  LifeBuoy,
  LogIn,
  MapPin,
  MessageCircle,
  Mic,
  PhoneCall,
  RefreshCcw,
  Rocket,
  Send,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

type HelpOption = {
  id: string;
  label: string;
  icon?: typeof HelpCircle;
  answer?: string[];
  next?: HelpOption[];
  form?: 'licensed_states' | 'change_market' | 'ticket' | 'live_help';
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD',
  'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH',
  'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
];

const rootOptions: HelpOption[] = [
  {
    id: 'add_states',
    label: 'Add Licensed States',
    icon: MapPin,
    answer: [
      'Select the states you are licensed in. This updates your customer routing record and the lead routing profile will pick it up.',
      'After updating, refresh Connect before syncing the queue again.',
    ],
    form: 'licensed_states',
  },
  {
    id: 'change_market',
    label: 'Change Market',
    icon: Globe,
    answer: [
      'Choose the market you should be assigned to. This updates your customer record.',
      'Use this only for the agent currently signed in unless support tells you otherwise.',
    ],
    form: 'change_market',
  },
  {
    id: 'fix_vdp',
    label: 'Fix VDP / Call Connector Error',
    icon: Wrench,
    answer: [
      'First check microphone permission, reload Connect, and power WebRTC back on.',
      'If the queue, VDP, or dialer still fails, submit the exact page, lead ID, and what button was clicked.',
    ],
    next: [
      {
        id: 'fix_vdp_mic',
        label: 'Microphone / WebRTC is not working',
        answer: [
          'Allow microphone access in the browser or desktop app.',
          'On Mac, check System Settings > Privacy & Security > Microphone and make sure the app/browser is allowed.',
          'After changing permission, reload Connect and power on WebRTC again.',
        ],
      },
      {
        id: 'fix_vdp_queue',
        label: 'Queue or lead screen is wrong',
        answer: [
          'Do not keep dialing if the lead card and call target do not match.',
          'Send support the Masterlead ID, AO Lead ID, phone number, timestamp, and screenshot.',
        ],
        form: 'ticket',
      },
      {
        id: 'fix_vdp_ticket',
        label: 'Submit this to support',
        answer: ['Send the exact issue to support so they can trace it.'],
        form: 'ticket',
      },
    ],
  },
  {
    id: 'login_issue',
    label: 'Login Issue',
    icon: LogIn,
    answer: [
      'If you can sign in but the app is wrong, refresh and confirm you are using the correct company email.',
      'If you cannot sign in at all, use Reset Password or submit a support ticket.',
    ],
    next: [
      {
        id: 'reset_password',
        label: 'Reset Password',
        icon: Key,
        answer: [
          'Use Forgot Password on the login page.',
          'If the email does not arrive, submit a ticket with the email you are trying to use.',
        ],
        form: 'ticket',
      },
      {
        id: 'login_ticket',
        label: 'Submit login issue',
        form: 'ticket',
      },
    ],
  },
  {
    id: 'call-connector',
    label: 'Call Connector Pro',
    icon: PhoneCall,
    next: [
      {
        id: 'ccpro-no-leads',
        label: 'Leads or queue are not loading',
        answer: [
          'If the queue is pending, the system is checking subscription status, routing profile, eligible leads, and local calling hours.',
          'Refresh Connect once. If it still shows pending, check whether the subscription is active and whether the agent has market/states in the customer record.',
          'If the panel says no eligible leads, there may be no callable leads for the agent market/state at that moment.',
        ],
      },
      {
        id: 'ccpro-wrong-lead',
        label: 'Wrong lead or wrong number dialing',
        answer: [
          'The lead card should show Masterlead ID, AO Lead ID, and phone. The dialer should call that same phone.',
          'If the displayed lead and dialed phone do not match, stop dialing and report the Masterlead ID, AO Lead ID, phone, and timestamp.',
          'Support can compare the active leasedialer assignment against the call log to confirm the source.',
        ],
      },
      {
        id: 'ccpro-disposition',
        label: 'Disposition is missing or blocked',
        answer: [
          'After a dial attempt, the disposition menu should allow normal resolutions including No Answer / Voicemail, Booked, Callback, Not Interested, Sale, and Wrong Number.',
          'If only Wrong Number appears, reload the page. If it persists, report the lead ID and browser URL.',
        ],
      },
      {
        id: 'ccpro-local-presence',
        label: 'Local presence caller ID',
        answer: [
          'Outbound calls use local presence by lead state. If an exact area code is not available, the system uses another local number from that state.',
          'If no state number exists, it falls back to the default caller ID.',
        ],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Credits',
    icon: CreditCard,
    next: [
      {
        id: 'billing-inactive',
        label: 'Subscription inactive',
        answer: [
          'If your subscription is inactive, lead sync pauses and you may see a reactivation message.',
          'Reactivate Call Connector Pro from the billing or subscription prompt, then refresh Connect.',
        ],
      },
      {
        id: 'billing-payment',
        label: 'Payment or checkout problem',
        answer: [
          'If checkout fails, confirm the payment method is supported and not blocked by the card issuer.',
          'If you see repeated failures, wait before retrying because processors may temporarily block too many failed attempts.',
        ],
      },
    ],
  },
  {
    id: 'training',
    label: 'Training & Practice',
    icon: MessageCircle,
    answer: [
      'Use the Onboarding and Training sections for training videos and practice tools.',
      'If your training gate is wrong, submit a ticket with your email and what section is locked.',
    ],
    form: 'ticket',
  },
  {
    id: 'webrtc',
    label: 'WebRTC / Microphone',
    icon: Mic,
    next: [
      {
        id: 'webrtc-mic',
        label: 'Microphone issue',
        answer: [
          'Allow microphone access in the browser or desktop app.',
          'On Mac, also check System Settings > Privacy & Security > Microphone and make sure the app/browser is allowed.',
          'After changing permission, reload Connect and power on WebRTC again.',
        ],
      },
      {
        id: 'webrtc-power',
        label: 'Power on or registration issue',
        answer: [
          'Power On controls the WebRTC media device. Online/Offline controls inbound availability; they are separate.',
          'If Power On fails, refresh the page, confirm microphone permission, and check network/VPN restrictions.',
        ],
      },
    ],
  },
  {
    id: 'aomeet',
    label: 'AO Meet',
    icon: MessageCircle,
    answer: [
      'For AO Meet issues, confirm the lead has a valid phone/email and try creating the meet again.',
      'If the meeting link fails, copy the lead name, phone, and timestamp for support.',
    ],
  },
  {
    id: 'account',
    label: 'Account / Login',
    icon: LogIn,
    answer: [
      'If you cannot log in, use Forgot Password from the login page.',
      'If your email is not recognized, contact support with your company email and manager.',
    ],
  },
  {
    id: 'bug',
    label: 'Something Else / Report a Bug',
    icon: LifeBuoy,
    answer: [
      'Send support the page you were on, the exact button clicked, the lead ID if applicable, and a screenshot.',
      'For dialer problems, include Masterlead ID, AO Lead ID, phone number, and the approximate time.',
    ],
    form: 'ticket',
  },
  {
    id: 'live_help',
    label: 'Get Live Help',
    icon: MessageCircle,
    answer: [
      'This will add you to the live help queue if support is available.',
      'If no one is live, submit a ticket with the details.',
    ],
    form: 'live_help',
  },
];

function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-700 p-[3px] shadow-[0_0_24px_rgba(59,130,246,0.55)] ${
        small ? 'h-10 w-10' : 'h-14 w-14'
      }`}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
        <Rocket className={small ? 'h-5 w-5 text-blue-600' : 'h-7 w-7 text-blue-600'} />
      </div>
    </div>
  );
}

export default function GuidedHelpWidget() {
  const { authState } = useAuth();
  const [open, setOpen] = useState(false);
  const [anchorLeft, setAnchorLeft] = useState(252);
  const [selectedPath, setSelectedPath] = useState<HelpOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answeredHelpful, setAnsweredHelpful] = useState<boolean | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesLoadedFor, setStatesLoadedFor] = useState('');
  const [market, setMarket] = useState('Veteran');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  useEffect(() => {
    const openHelp = (event: Event) => {
      const customEvent = event as CustomEvent<{ anchorLeft?: number }>;
      if (typeof customEvent.detail?.anchorLeft === 'number') {
        setAnchorLeft(customEvent.detail.anchorLeft);
      }
      setOpen(true);
    };
    window.addEventListener('aoirail-open-guided-help', openHelp);
    return () => window.removeEventListener('aoirail-open-guided-help', openHelp);
  }, []);

  const current = selectedPath[selectedPath.length - 1] || null;
  const visibleOptions = current ? current.next || [] : rootOptions;
  const title = current ? current.label : 'Please let me know how I can help you!';
  const answerLines = current?.answer || [];
  const userEmail = authState.user?.email || '';
  const userName =
    authState.user?.user_metadata?.full_name ||
    authState.user?.user_metadata?.name ||
    (userEmail ? userEmail.split('@')[0] : '');

  const trail = useMemo(() => selectedPath.map((item) => item.label).join(' / '), [selectedPath]);

  useEffect(() => {
    if (current?.form !== 'licensed_states' || !userEmail) return;
    const loadKey = `${userEmail}:${current.id}`;
    if (statesLoadedFor === loadKey) return;
    setStatesLoading(true);
    fetch(`/api/agent/licensed-states?email=${encodeURIComponent(userEmail)}`)
      .then((response) => (response.ok ? response.json() : { states: [] }))
      .then((data) => {
        const states = Array.isArray(data?.states)
          ? data.states.map((state: unknown) => String(state || '').trim().toUpperCase()).filter((state: string) => /^[A-Z]{2}$/.test(state))
          : [];
        setSelectedStates(Array.from(new Set(states)).sort());
        setStatesLoadedFor(loadKey);
      })
      .catch(() => {
        setSelectedStates([]);
        setStatesLoadedFor(loadKey);
      })
      .finally(() => setStatesLoading(false));
  }, [current?.form, current?.id, statesLoadedFor, userEmail]);

  const chooseOption = (option: HelpOption) => {
    setSelectedOptionId(option.id);
    setAnsweredHelpful(null);
    setSubmitResult(null);
    setTimeout(() => {
      setSelectedPath((prev) => [...prev, option]);
      setSelectedOptionId(null);
    }, 220);
  };

  const reset = () => {
    setSelectedPath([]);
    setSelectedOptionId(null);
    setAnsweredHelpful(null);
    setSubmitResult(null);
  };

  const back = () => {
    setSelectedPath((prev) => prev.slice(0, -1));
    setAnsweredHelpful(null);
    setSubmitResult(null);
  };

  const rewindToChoice = (index: number) => {
    setSelectedPath((prev) => prev.slice(0, index));
    setAnsweredHelpful(null);
    setSubmitResult(null);
  };

  const submitCurrentForm = async () => {
    if (!current?.form) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      if (current.form === 'licensed_states') {
        const res = await fetch('/api/alex-ai/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail,
            action: 'add_licensed_states',
            parameters: { states: selectedStates },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to update states');
        setStatesLoadedFor('');
        setSubmitResult(data?.result?.message || 'Licensed states updated. Refresh Connect before syncing again.');
        return;
      }

      if (current.form === 'change_market') {
        const res = await fetch('/api/alex-ai/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail,
            action: 'change_market',
            parameters: { market },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to update market');
        setSubmitResult(data?.result?.message || `Market updated to ${market}. Refresh Connect before syncing again.`);
        return;
      }

      if (current.form === 'live_help') {
        const res = await fetch('/api/help/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: userName || userEmail || 'Unknown',
            email: userEmail,
            subject: 'Live help request',
            message: ticketMessage || 'Agent requested live help from guided help.',
            category: current.id,
            urgency: 'high',
            userEmail,
            timestamp: new Date().toISOString(),
            userId: userEmail || 'guided-help',
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Could not submit live help request');
        setSubmitResult('Live help request sent. Support will follow up.');
        return;
      }

      const subject = ticketSubject || current.label;
      const message = ticketMessage || `Support request from guided help: ${current.label}`;
      const res = await fetch('/api/help/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName || userEmail || 'Unknown',
          email: userEmail,
          subject,
          message,
          category: current.id,
          urgency: current.id.includes('vdp') || current.id.includes('queue') ? 'high' : 'normal',
          timestamp: new Date().toISOString(),
          userId: userEmail || 'guided-help',
        }),
      });
      if (!res.ok) throw new Error('Failed to submit support request');
      setSubmitResult('Support request sent. We will follow up.');
      setTicketSubject('');
      setTicketMessage('');
    } catch (error) {
      setSubmitResult(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((item) => item !== state) : [...prev, state].sort(),
    );
  };

  return (
    <>
      <div
        className={`fixed bottom-4 top-4 z-[9999] transform overflow-hidden rounded-r-3xl border-y border-r border-white/10 bg-[#0b1020] text-white shadow-2xl transition-all duration-300 ${
          open ? 'translate-x-0 opacity-100' : '-translate-x-full pointer-events-none opacity-0'
        }`}
        style={{
          left: anchorLeft,
          width: `min(420px, calc(100vw - ${anchorLeft + 16}px))`,
        }}
      >
        <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.20),transparent_40%)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">AOI Support</div>
              {trail && <div className="mt-0.5 max-w-[300px] truncate text-xs text-slate-400">{trail}</div>}
            </div>
            <div className="flex items-center gap-2">
              {selectedPath.length > 0 && (
                <button type="button" onClick={back} className="rounded-full bg-white/10 p-2 text-slate-200 hover:bg-white/20">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-red-500 p-2 text-white hover:bg-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <BotAvatar />
                <div className="rounded-2xl rounded-bl-md bg-white/12 px-4 py-3 text-base font-semibold text-slate-100 shadow-lg">
                  Hi, I am AOI Help!
                </div>
              </div>

              <div className="ml-12 rounded-2xl bg-white/12 px-4 py-3 text-sm text-slate-100 shadow-lg">{title}</div>

              {answerLines.length > 0 && (
                <div className="ml-12 rounded-2xl bg-white/12 px-4 py-4 text-sm leading-6 text-slate-100 shadow-lg">
                  {answerLines.map((line) => (
                    <p key={line} className="mb-3 last:mb-0">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              {selectedPath.length > 0 && (
                <div className="ml-12 space-y-2">
                  {selectedPath.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex items-center gap-2 rounded-2xl bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100"
                    >
                      <span className="min-w-0 flex-1 truncate">You selected: {item.label}</span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg">
                        <Check className="h-5 w-5" />
                      </span>
                      <button
                        type="button"
                        onClick={() => rewindToChoice(index)}
                        className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-100 hover:bg-white/20"
                      >
                        Rewind
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {visibleOptions.length > 0 && (
                <div className="ml-5 rounded-2xl bg-white/10 p-3 shadow-xl">
                  <div className="space-y-1">
                    {visibleOptions.map((option) => {
                      const Icon = option.icon || Check;
                      const selected = selectedOptionId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => chooseOption(option)}
                          className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                            selected ? 'bg-sky-500/25 text-sky-200' : 'text-slate-100 hover:bg-white/10'
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${selected ? 'text-sky-300' : 'text-slate-300'}`} />
                          <span className="flex-1">{option.label}</span>
                          {selected && (
                            <span className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg">
                              <Check className="h-6 w-6" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {current?.form && (
                <div className="ml-12 space-y-3 rounded-2xl bg-white/10 p-4 text-sm">
                  {current.form === 'licensed_states' && (
                    <>
                      <div className="font-bold text-white">Select licensed states</div>
                      {statesLoading && <div className="text-xs text-sky-100">Loading current licensed states...</div>}
                      <div className="grid grid-cols-5 gap-2">
                        {US_STATES.map((state) => (
                          <button
                            key={state}
                            type="button"
                            onClick={() => toggleState(state)}
                            className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                              selectedStates.includes(state)
                                ? 'bg-sky-500 text-white'
                                : 'bg-white/10 text-slate-200 hover:bg-white/20'
                            }`}
                          >
                            {state}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-slate-300">This will save exactly: {selectedStates.join(', ') || 'no states'}</div>
                    </>
                  )}

                  {current.form === 'change_market' && (
                    <>
                      <div className="font-bold text-white">Choose market</div>
                      <select
                        value={market}
                        onChange={(event) => setMarket(event.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white"
                      >
                        <option value="Veteran">Veteran</option>
                        <option value="Globe">Globe</option>
                        <option value="AO Recruit">AO Recruit</option>
                      </select>
                    </>
                  )}

                  {current.form === 'ticket' && (
                    <>
                      <div className="font-bold text-white">Send support details</div>
                      <input
                        value={ticketSubject}
                        onChange={(event) => setTicketSubject(event.target.value)}
                        placeholder="Subject"
                        className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
                      />
                      <textarea
                        value={ticketMessage}
                        onChange={(event) => setTicketMessage(event.target.value)}
                        placeholder="What happened? Include page, lead ID, screenshot details, and exact button clicked."
                        rows={4}
                        className="w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
                      />
                    </>
                  )}

                  <Button
                    type="button"
                    onClick={submitCurrentForm}
                    disabled={submitting || !userEmail}
                    className="w-full rounded-full bg-sky-500 text-white hover:bg-sky-600"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? 'Submitting...' : current.form === 'live_help' ? 'Join live help' : 'Submit'}
                  </Button>
                  {!userEmail && <div className="text-xs text-amber-200">Sign in is required for this action.</div>}
                  {submitResult && <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-100">{submitResult}</div>}
                </div>
              )}

              {current && !current.next && (
                <div className="ml-12 space-y-3">
                  <div className="rounded-2xl bg-white/12 px-4 py-3 text-sm font-semibold text-slate-100">
                    Has my answer helped resolve the problem?
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-3">
                    <Button
                      type="button"
                      onClick={() => setAnsweredHelpful(true)}
                      className="rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAnsweredHelpful(false)}
                      className="rounded-full bg-white/10 text-white hover:bg-white/20"
                    >
                      No
                    </Button>
                  </div>
                  {answeredHelpful === true && (
                    <div className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
                      Great. I’m glad that helped.
                    </div>
                  )}
                  {answeredHelpful === false && (
                    <div className="rounded-2xl bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                      Please open a support ticket or include the exact page, lead ID, and a screenshot so support can investigate.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
            <button type="button" onClick={reset} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300 hover:text-white">
              <RefreshCcw className="h-4 w-4" />
              Restart
            </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/20"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              Help
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
