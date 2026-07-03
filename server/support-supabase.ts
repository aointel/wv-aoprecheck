/**
 * Support bookings and queue - Supabase backend.
 * Run create-support-tables-supabase.sql and create-master-schedule.sql in Supabase first.
 */
import { supabaseAdmin } from './supabase';
import { upsertMasterSchedule } from './master-schedule-service';

export async function ensureSupportTables(): Promise<void> {
  // Tables are created via migration SQL - no-op here
}

export async function createSupportBooking(params: {
  userEmail: string;
  name: string;
  slotStart: string;
  slotEnd: string;
  issueCategory: string;
}): Promise<{ id: number; user_email: string; name: string; slot_start: string; slot_end: string } | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('support_bookings')
    .insert({
      user_email: params.userEmail,
      name: params.name,
      slot_start: params.slotStart,
      slot_end: params.slotEnd,
      issue_category: params.issueCategory || 'general',
    })
    .select('id, user_email, name, slot_start, slot_end')
    .single();
  if (error) throw error;
  if (data) {
    await upsertMasterSchedule({
      agentEmail: params.userEmail,
      slotStart: params.slotStart,
      slotEnd: params.slotEnd,
      scheduleType: 'support',
      sourceTable: 'support_bookings',
      sourceId: String(data.id),
      title: 'AOI Support',
      metadata: { name: params.name, issueCategory: params.issueCategory },
    });
  }
  return data as any;
}

export async function countSupportBookingsBySlot(slotStart: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('support_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('slot_start', slotStart);
  if (error) throw error;
  return count ?? 0;
}

export async function getSupportBookingById(id: number): Promise<{
  id: number;
  user_email: string;
  name: string;
  slot_start: string;
  slot_end: string;
} | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('support_bookings')
    .select('id, user_email, name, slot_start, slot_end')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as any;
}

export async function getUpcomingSupportBooking(email: string): Promise<{
  id: number;
  slot_start: string;
  slot_end: string;
} | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('support_bookings')
    .select('id, slot_start, slot_end')
    .ilike('user_email', email)
    .gt('slot_start', new Date().toISOString())
    .order('slot_start', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as any;
}

export async function joinSupportQueue(params: {
  bookingId: number;
  email: string;
  name: string;
  issueCategory: string;
}): Promise<{ id: number; position: number; status: string; zoom_link: string | null } | null> {
  if (!supabaseAdmin) return null;
  const existing = await supabaseAdmin
    .from('support_queue')
    .select('id, position, status, zoom_link')
    .eq('booking_id', params.bookingId)
    .eq('status', 'waiting')
    .maybeSingle();
  if (existing.data) {
    return existing.data as any;
  }
  const { data: maxPos } = await supabaseAdmin
    .from('support_queue')
    .select('position')
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (maxPos?.position ?? 0) + 1;
  const { data: inserted, error } = await supabaseAdmin
    .from('support_queue')
    .insert({
      user_email: params.email,
      name: params.name,
      issue_category: params.issueCategory || 'general',
      position: nextPos,
      status: 'waiting',
      booking_id: params.bookingId,
    })
    .select('id, position, status, zoom_link')
    .single();
  if (error) throw error;
  return inserted as any;
}

export async function getQueueStatus(queueId: number): Promise<{
  id: number;
  position: number;
  status: string;
  zoom_link: string | null;
  slot_start: string | null;
  slot_end: string | null;
} | null> {
  if (!supabaseAdmin) return null;
  const { data: q, error: qErr } = await supabaseAdmin
    .from('support_queue')
    .select('id, position, status, zoom_link, booking_id')
    .eq('id', queueId)
    .single();
  if (qErr || !q) return null;
  let slot_start: string | null = null;
  let slot_end: string | null = null;
  if (q.booking_id) {
    const { data: b } = await supabaseAdmin
      .from('support_bookings')
      .select('slot_start, slot_end')
      .eq('id', q.booking_id)
      .single();
    if (b) {
      slot_start = b.slot_start;
      slot_end = b.slot_end;
    }
  }
  return { ...q, slot_start, slot_end } as any;
}

export async function updateQueueEntry(id: number, updates: { status?: string; zoom_link?: string }): Promise<void> {
  if (!supabaseAdmin) return;
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.zoom_link !== undefined) payload.zoom_link = updates.zoom_link;
  await supabaseAdmin.from('support_queue').update(payload).eq('id', id);
}

export async function listWaitingQueue(): Promise<any[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('support_queue')
    .select('id, user_email, name, issue_category, joined_at, position, status, zoom_link, booking_id')
    .eq('status', 'waiting')
    .order('position', { ascending: true })
    .order('joined_at', { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function listInSessionQueue(): Promise<any[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('support_queue')
    .select('id, user_email, name, issue_category, joined_at, position, status, zoom_link, booking_id, updated_at')
    .eq('status', 'in_session')
    .order('updated_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function cleanupStaleQueueEntries(): Promise<void> {
  if (!supabaseAdmin) return;
  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: expired } = await supabaseAdmin
    .from('support_bookings')
    .select('id')
    .lt('slot_end', now);
  if (expired?.length) {
    const ids = expired.map((r) => r.id);
    await supabaseAdmin
      .from('support_queue')
      .update({ status: 'abandoned', updated_at: now })
      .in('booking_id', ids)
      .eq('status', 'waiting');
  }
  await supabaseAdmin
    .from('support_queue')
    .update({ status: 'abandoned', updated_at: now })
    .eq('status', 'in_session')
    .lt('updated_at', staleThreshold);
}
