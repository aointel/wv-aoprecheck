import { supabaseAdmin } from '../supabase';
import { calculateDialReachBookedRealtime } from './calculate-dial-reach-booked-realtime';
import { resolveChrisRecipients } from '../activity-card-report-service';

async function verifyParity() {
  const { scope } = await resolveChrisRecipients();
  const stats = await calculateDialReachBookedRealtime(undefined, 'realtime');
  const byEmail = new Map(stats.map((s) => [s.agentEmail.toLowerCase(), s]));

  let lcbRows: any[] = [];
  const liveBoard = await supabaseAdmin
    .from('live_call_board')
    .select('agent_email, today_dialed, today_reached, today_booked, today_instant_presentation')
    .in('agent_email', scope.agentEmails);

  if (liveBoard.error) {
    const fallback = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked, today_instant_presentation')
      .in('agent_email', scope.agentEmails);
    if (fallback.error) throw fallback.error;
    lcbRows = fallback.data || [];
  } else {
    lcbRows = liveBoard.data || [];
  }

  console.log('=== Activity Card vs Live Call Board parity ===');
  for (const row of lcbRows) {
    const email = String((row as any).agent_email || '').toLowerCase();
    const s = byEmail.get(email);
    const dialDiff = Number((row as any).today_dialed || 0) - Number(s?.dialed || 0);
    const reachDiff = Number((row as any).today_reached || 0) - Number(s?.reached || 0);
    const bookedDiff = Number((row as any).today_booked || 0) - Number(s?.booked || 0);
    const instantDiff = Number((row as any).today_instant_presentation || 0) - Number(s?.instantPresentation || 0);
    console.log(`${email} | dials:${dialDiff} reach:${reachDiff} booked:${bookedDiff} instant:${instantDiff}`);
  }
}

verifyParity().catch((e) => {
  console.error('Parity check failed:', e);
  process.exit(1);
});

