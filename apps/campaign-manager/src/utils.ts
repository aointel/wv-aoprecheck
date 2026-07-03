import type { AgentStatus } from '../shared/types';

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

export function durationSince(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return '0:00';
  const totalSecs = Math.floor(diff / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatPhone(p: string | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^1/, '');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return p;
}

export function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'idle': return '#10b981';
    case 'busy': return '#ef4444';
    case 'away': return '#f59e0b';
    case 'suspended': return '#6b7280';
    case 'offline': return '#374151';
  }
}

export function statusLabel(status: AgentStatus): string {
  switch (status) {
    case 'idle': return 'IDLE';
    case 'busy': return 'ON CALL';
    case 'away': return 'AWAY';
    case 'suspended': return 'SUSPENDED';
    case 'offline': return 'OFFLINE';
  }
}

export function statusDot(status: AgentStatus): string {
  switch (status) {
    case 'idle': return '🟢';
    case 'busy': return '🔴';
    case 'away': return '🟡';
    case 'suspended': return '⛔';
    case 'offline': return '⚫';
  }
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (result[k] ??= []).push(item);
  }
  return result;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
