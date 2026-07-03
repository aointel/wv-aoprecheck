import { useEffect, useState } from 'react';

const PST = 'America/Los_Angeles';

export const SUPPORT_SCHEDULE_TEXT = 'Mon 12–2 PM, Tue 9–10:30 AM, Thu 9–10:30 AM PST';

// Support hours: Mon 12–2 PM, Tue 9–10:30 AM, Thu 9–10:30 AM PST — single source of truth
export const SUPPORT_SCHEDULE: { dayOfWeek: number; label: string; startMin: number; endMin: number }[] = [
  { dayOfWeek: 1, label: 'Mon', startMin: 12 * 60, endMin: 14 * 60 },
  { dayOfWeek: 2, label: 'Tue', startMin: 9 * 60, endMin: 10 * 60 + 30 },
  { dayOfWeek: 4, label: 'Thu', startMin: 9 * 60, endMin: 10 * 60 + 30 },
];

const SUPPORT_HOURS = SUPPORT_SCHEDULE;

export function isSupportLive(): boolean {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PST, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const dowStr = get('weekday').slice(0, 3);
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }[dowStr] ?? -1;
  const hour = parseInt(get('hour'), 10) || 0;
  const minute = parseInt(get('minute'), 10) || 0;
  const nowMin = hour * 60 + minute;
  const sched = SUPPORT_HOURS.find((s) => s.dayOfWeek === dow);
  if (!sched) return false;
  return nowMin >= sched.startMin && nowMin < sched.endMin;
}

export function useSupportLive(): boolean {
  const [live, setLive] = useState(isSupportLive);
  useEffect(() => {
    const interval = setInterval(() => setLive(isSupportLive()), 60000);
    return () => clearInterval(interval);
  }, []);
  return live;
}
