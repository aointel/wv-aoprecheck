import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PreflightResult } from '@/hooks/use-agent-diagnostics';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface PreflightCheckModalProps {
  open: boolean;
  onClose: () => void;
  preflight: PreflightResult | null;
}

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
  if (warn) return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />;
  return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
}

export default function PreflightCheckModal({ open, onClose, preflight }: PreflightCheckModalProps) {
  if (!preflight) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preflight Check</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Running checks…</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const micOk = preflight.mic === 'ok';
  const micNone = preflight.mic === 'none';
  const creditsOk = preflight.credits > 0;
  const networkOk = preflight.network.quality !== 'offline';
  const networkWarn = preflight.network.quality === 'poor' || preflight.network.quality === 'fair';

  const checks = [
    {
      label: 'Microphone',
      ok: micOk || micNone,
      warn: micNone,
      detail: micOk
        ? 'Granted'
        : micNone
        ? 'Not yet granted — browser will ask'
        : 'Blocked — enable in browser settings',
    },
    {
      label: 'Browser',
      ok: true,
      detail: `${preflight.browser.name} ${preflight.browser.version}`,
    },
    {
      label: 'Credits',
      ok: creditsOk,
      detail: creditsOk
        ? `${preflight.credits.toLocaleString()} remaining`
        : preflight.credits === -1
        ? 'Unable to fetch — check connection'
        : '0 remaining — purchase more credits',
    },
    {
      label: 'Network',
      ok: networkOk && !networkWarn,
      warn: networkWarn,
      detail: networkOk
        ? `${preflight.network.latency}ms (${preflight.network.quality})`
        : 'Offline — check your connection',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preflight Check</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-3">
              <StatusIcon ok={c.ok} warn={c.warn} />
              <div>
                <div className="font-medium text-sm">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {!preflight.ready && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            One or more critical checks failed. The dialer may not work correctly.
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant={preflight.ready ? 'default' : 'outline'}>
            {preflight.ready ? 'Continue' : 'Continue Anyway'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
