import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

function toPstDayStartIsoDateOnly(): string {
  const now = new Date();
  const pstOffsetMs = 7 * 60 * 60 * 1000; // PDT
  const pseudoPst = new Date(now.getTime() - pstOffsetMs);
  return pseudoPst.toISOString().slice(0, 10);
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const agent = String(getArg('agent') || '').toLowerCase().trim();
  if (!agent) throw new Error('Missing --agent=<email or identity fragment>');
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error('Twilio credentials missing');

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const startTimeAfter = toPstDayStartIsoDateOnly();

  const calls: any[] = [];
  let startTimeBefore: string | undefined;
  while (true) {
    const page = await client.calls.list({
      startTimeAfter,
      startTimeBefore,
      limit: 1000,
    } as any);
    if (page.length === 0) break;
    calls.push(...page);
    if (page.length < 1000) break;
    const last = page[page.length - 1] as any;
    const lastStart = last.startTime ?? last.dateCreated;
    if (!lastStart) break;
    const d = new Date(lastStart);
    if (Number.isNaN(d.getTime())) break;
    d.setSeconds(d.getSeconds() - 1);
    startTimeBefore = d.toISOString().slice(0, 19);
  }
  const filtered = calls.filter((c: any) => {
    const from = String(c.from || '').toLowerCase();
    const to = String(c.to || '').toLowerCase();
    const sid = String(c.sid || '');
    return from.includes(agent) || to.includes(agent);
  });

  const out = filtered.map((c: any) => ({
    sid: c.sid,
    dateCreated: c.dateCreated ? new Date(c.dateCreated).toISOString() : null,
    startTime: c.startTime ? new Date(c.startTime).toISOString() : null,
    endTime: c.endTime ? new Date(c.endTime).toISOString() : null,
    direction: c.direction,
    status: c.status,
    duration: c.duration,
    from: c.from,
    to: c.to,
    parentCallSid: c.parentCallSid || null,
  }));

  const matchedSidSet = new Set(out.map((c) => c.sid));
  const relatedChildCalls = calls
    .filter((c: any) => {
      const parent = String(c.parentCallSid || '');
      return parent && matchedSidSet.has(parent) && !matchedSidSet.has(String(c.sid || ''));
    })
    .map((c: any) => ({
      sid: c.sid,
      parentCallSid: c.parentCallSid || null,
      dateCreated: c.dateCreated ? new Date(c.dateCreated).toISOString() : null,
      startTime: c.startTime ? new Date(c.startTime).toISOString() : null,
      endTime: c.endTime ? new Date(c.endTime).toISOString() : null,
      direction: c.direction,
      status: c.status,
      duration: c.duration,
      from: c.from,
      to: c.to,
    }));

  console.log(
    JSON.stringify(
      {
        agent,
        startTimeAfter,
        totalCallsFetched: calls.length,
        matchedCalls: out.length,
        relatedChildCalls: relatedChildCalls.length,
        calls: out,
        childCalls: relatedChildCalls,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error((e as Error)?.message || String(e));
  process.exit(1);
});

